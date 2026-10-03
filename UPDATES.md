# MAKE OS — Updates planen

Kevin 25.09.2026: „Das Ganze hier vorbereiten und später ein Update sauber
planen — dann müssen wir nicht immer wieder hochladen. Dann haben wir einen
Stand hier und einen Stand, der online ist.“

## Lichtfäden: Zeitstrahl der Planung + roter Faden der Landingpage (03.10.2026, nur lokal — Branch `lichtfaeden`; Standard `DESIGN_STANDARD.md` › „Lichtfäden“)

Kevin 03.10. (Vorbild ein Daten-Zeitstrahl aus hunderten feinen, leuchtenden Linien): „Hier bei der Planung wäre geil, wenn das so reinkommt mit mehreren Elektro-Fäden … das kann sich auch mit durch die Homepage ziehen.“

- **Planung › Jahr:** Der Zeitstrahl zeigt statt der Achse ein Band aus Lichtfäden — **je Ziel ein Bündel in seiner Farbe** (Business zuerst gelb wie die Markierungen bisher, Privat zuerst grün, „ohne Ziel“ in Zeit-Cyan), alle zu einem Band verflochten. **Auffächern und Leuchten je Woche aus echten Daten** (`lib/lichtfaeden/dichte.ts` `faedenDichte`: offener Meilenstein 3, erledigter 1, Ziel-Frist 3, offene Aufgabe 1 bzw. dringend 1,5 über die Liste ihres Meilensteins; Gauß σ = 2 Wochen, weich gesättigt). Vergangenheit gedämpft, HEUTE als leuchtender Schnitt, feine Mittellinie, Achse wie bisher darunter, Legende der Bündel.
- **Markierungen** schweben als echte Knöpfe über dem Band (Glas-Chip mit Raute/Quadrat/Haken in Bündelfarbe, feine Verbindungslinie zum Bündel), gestapelt wie bisher, „+n“ bleibt; Zeigen/Fokus hebt das Bündel hervor, die anderen dimmen. Am Handy Knöpfe 44 px, Band 104 px, drei Reihen. Bedienung unverändert (Bereiche, Blättern, Heute, „+ Meilenstein“, Planungsjahr, Forecast). Leinwand `aria-hidden`, Textäquivalent für Vorleser.
- **Bewegung:** ruhiges Fließen, pausiert außerhalb des Bildes/Tabs, „Bewegung reduzieren“ = Standbild. Gemessen (Sandbox, 1280, 7 Bündel × 22 Fäden): 60 fps, Zeichnen im Mittel 1,3–1,8 ms je Bild; Handy 11 Fäden je Bündel.
- **Landingpage:** zwei Bündel (Granat/Smaragd) kommen aus dem Logo — Rot aus dem roten, Grün aus dem grünen Strich in einem Bogen unter dem Logo — und ziehen sich zwischen Text und Neuronen-Bühne durch alle Kapitel: verflochten bei „Warum Innovation“, drei Stufen mit aufsteigendem Licht bei „Beratung“, aufgefächert bei „Make.One“, im Kontakt zurück in die Striche und den Knoten. Am Handy an den Rändern. +19 KB Skript (`js/lichtfaeden.js` übersetzt aus der App, `js/faden.js`).
- **Ein Zeichner für beide:** `lib/lichtfaeden/band.ts` (rein) + `zeichnen.ts` (Canvas 2D, Path2D-Eimer) → `node scripts/lichtfaeden-website.mjs` erzeugt `website/js/lichtfaeden.js`; Wächter vergleicht.
- **Kleinkorrektur nebenbei:** Quartalsnamen unter dem Zeitstrahl wurden unten abgeschnitten (+6 px Höhe, gilt für alle Zeitstrahlen).
- **Test:** `tests/lichtfaeden.test.ts` (Dichte deterministisch, Gewichtung, Zeitraum/Rand, höchstens 6 Ziel-Bündel, Textäquivalent, Farben, Mathematik, Markierungen ohne Überlappung + 44 px am Handy, reduzierte Bewegung, Website-Kopie). `node website/pruefen.mjs`: nur die bekannten Platzhalter offen.
- **Rückweg:** reine Darstellung, keine neuen Bestände oder Felder.

## Design-Standard: Zahlen & Finanzen (03.10.2026, nur lokal — Branch `design-finanzen`; Dokument `DESIGN_STANDARD.md` › „Umgestellt: Zahlen & Finanzen“)

Zweiter Bereich nach der Markttraktion. Reine Darstellung und Struktur — keine Rechnung, kein Feld, keine Funktion geändert; die Finanzplanung bleibt in jedem Feld anpassbar.

- **Umgestellt (51 Dateien, alle über `components/os/ui`):** Zahlen (Privat mit Haushalt-Reitern · Business · Steuern · Gesamt · Head of Finance), Grundlage, Liquidität, Buchungen, Rechnungen & Zahlungen, Controlling & Ziele, Business-Altbestand (Rahmen; das eingebettete Alt-Cockpit bleibt wie es ist) und die Finanzplanung jetzt mit allen 19 Unterseiten (Blatt, Szenarien, Diagramme).
- **Handy:** Kopf kompakt (Titel + Symbol-Aktionen, ein Satz), EINE wischbare Reiterleiste; breite Umschalter (Wochen, Sicht, Bereiche) stehen im Inhalt statt im Kopf; Tabellen und das Blatt in eigenem wischbarem Container; Hero-Karte je Ansicht getönt, Kennzahl-Kacheln flach; Fehler als Hinweis-Karten mit Weg („Noch einmal versuchen“).
- **Messung (36 Ansichten, 375 px, erfundene Beispielzahlen):** Tippziele < 44 px **1.287 → 0**, Eingaben < 16 px **275 → 0**, seitlicher Überlauf 0 → 0, Text < 12,5 px (ohne Großbuchstaben-Beschriftungen) **1.426 → 232** (Rest: Chips 12 px des Standards, Diagrammachsen 12 px), Zahlen ohne feste Ziffern 2 → 0; Rechner: Text < 12,5 px 1.897 → 249. Konsole sauber (außer der bekannten Firebase-Warnung des eingebetteten Alt-Cockpits, schon vorher).
- **Neu im Standard:** `auswahl` (Auswahlliste), `.ui-tabelle`, `.ui-nur-schmal`; Segment-Umschalter laufen bei Enge seitwärts statt sich zu überlagern; Diagrammachsen dünnen auf schmalem Bildschirm aus.
- **Test:** `tests/design-finanzen.test.ts` (kein `schlank`-Import im Bereich, keine Schrift < 13 px außer Beschriftungen, Bausteine der Finanzplanung, Kopf und Reiterleiste).
- **Rückweg:** reiner Oberflächen-Commit, keine neuen Bestände.

## Design-Standard: Netzwerken-Look überall — Muster Markttraktion (03.10.2026, nur lokal — Branch `design`; Dokument `DESIGN_STANDARD.md`)

Kevin 03.10.: „Du hast bei dem Netzwerken das Ganze noch ein bisschen edler gebaut … ich möchte, dass du den Standard überall reinbringst.“ Entscheidung: erst Muster, dann alles — dies ist der Teil „Standard + Markttraktion komplett“; Zahlen/Finanzen und der Rest folgen. Reine Darstellung, keine Funktions- oder Datenänderung, **nichts auf dem Server nötig**.

- **Standard:** `DESIGN_STANDARD.md` (Befund „Warum wirkt Netzwerken edler?“, Token, Bausteine, 13 Regeln, Umstell-Rezept). Token in `lib/make-one/design.ts` (`ZIEL`, `ECKE`, `RAND`, `FLAECHE_STIL`, `BEDEUTUNG_FARBE`). Bausteine in `components/os/ui` (`Seite`, `Karte` gehoben/flach/`ton`, `Knopf` mit `haupt`, `Pillen`/`Segmente`/`Reiter`, `Hinweis` nach Bedeutung, `Leerzustand`/`Leer`, `Kennzahl`/`Zahl`+`Raster`, `Zeile`, Eingaben …). `schlank.tsx` bleibt für Altseiten unverändert — Umstellen = Import `../schlank` → `../ui` (gleiche Namen).
- **Netzwerken** hängt an denselben Bausteinen (`netzwerken/bausteine.tsx` reicht nur noch durch); Aussehen unverändert (Fotos Handy/Rechner im Vergleich).
- **Markttraktion (alle Reiter):** kompakter Kopf am Handy (Titel + Aktionen in einer Zeile, Satz darunter, ZOE als Symbol), **eine** wischbare Leiste statt zwei Zeilen (Kopf von 312–357 px auf 204–223 px), Rechner: Schnellknöpfe in der Reiterleiste statt eigener dritter Zeile; Fließtext ≥ 13 px (rund 760 Stellen), 25 Meldungen als Hinweis-Karten, Kennzahlen als Kacheln (am Handy zwei nebeneinander), die wichtige Karte je Ansicht in Bereichsfarbe (`ton`), Hauptaktion 48 px (+ Person/Firma/Deal/Follow-up/Event), Wer-Filter als Segmente, Deal-Stufen ohne Überlappung (Treppe wischbar, „Weiter, wenn“ als Hinweis), Kartei-Tabelle richtet sich nach der Kartenbreite (Container-Abfrage), Leerzustände mit Symbol (Kontakte, Events).
- **Handy-Netz:** `.ui-seite` (nur unter dem Anker der Seiten im Standard) erzwingt Tippziele ≥ 44 px (Links über eine unsichtbare Trefferfläche) und Eingaben 16 px. Messung Markttraktion (41 Ansichten + Netzwerken, 375 px): Tippziele < 44 px **1.671 → 0**, Eingaben < 16 px **90 → 0**, kein seitlicher Überlauf, Konsole ohne Fehler.
- **Offen (nicht in diesem Paket):** die globale Kopfzeile (Wachstum/Suche/Heute/Inbox … 34 px) und der Business-Index-Streifen gehören dem Kern, nicht der Markttraktion; Flächen-Seiten (`components/os/flaeche`) und `kennzahlen/` tragen noch `schlank.tsx`.
- **Test:** `tests/design-standard.test.ts` (Token, Bausteine, Netz nur unter `.ui-seite`, Markttraktion/Netzwerken hängen am Standard, Dokumentation nennt jeden Baustein); `tests/spaces.test.ts` an „Netzwerken nur am Handy“ (0488c71) angepasst.
- **Rückweg:** reiner Oberflächen-Commit, ohne neue Bestände oder Felder.

## Gmail in der Inbox (03.10.2026, nur lokal — Branch `gmail`; Einrichtung `GOOGLE_GMAIL_EINRICHTEN.md`)

Kevin 03.10.: Mails ziehen von IONOS zu Gmail; „bei uns in der Inbox bekommen wir die Antworten und formulieren das Ganze … Google ist nur die Verlängerung.“ Gewählt: **Lesen & zuordnen, Antworten per Klick, Aufgaben aus Mails.**

- **Eine Google-Verbindung, eine Freigabe mehr:** `gmail.modify` (nur diese — kein Vollzugriff, kein Löschen, keine Einstellungen); inkrementell über „Gmail verbinden“ in der Inbox, der Kalender bleibt unberührt. Trennen räumt auf.
- **Lesen:** je Person der eigene Spiegel (letzte 30 Tage, dann `history.list`, 404 → Neuabgleich), alle 2 Minuten, mit Pub/Sub-Push in Echtzeit (optional). Text statt HTML, Bilder nie geladen, Anhänge nur auf Klick, Aufbewahrung 180 Tage (Frist „Mail-Spiegel“).
- **Zuordnen:** „gehört zu …“ (alle Adressen der Kontakte → Firma/Deal), Verlaufszeile in der Kontaktakte (Betreff + Link in die Inbox), unbekannter Absender → „Kontakt anlegen“ (Anfrage über Mail = Marketing-Lead). Art. 18/Werbesperre: Anzeige ja, kein Verlauf, kein ZOE-Entwurf, kein Senden an Eingeschränkte.
- **Antworten:** Editor in der Inbox, Antwort im Thread, Absender = eigene Adresse/„Senden als“-Alias (z. B. `hello@`), optional ZOE-Entwurf mit Brain — **gesendet wird nur auf den Einzelklick** (ZOE/Takt/Skripte: 403); § 7-UWG-Rückfrage bei werblichem Text.
- **Aufgaben aus Mails:** je Mail Aufgabe, Follow-up, Termin (Business → Google Kalender), Kontakt anlegen, Erledigt (archivieren) — über die vorhandenen Schreibwege.
- **Recht/Betrieb:** Register + Art. 15/17 im Spiegel (Original bleibt in Gmail → Hinweis „dort löschen“), VVT „E-Mail (Google Workspace)“, HOI-Befund `gmail`, Anleitung mit Pub/Sub und der IONOS-Umstellung (MX/SPF/DKIM/DMARC; **hello@ ZUERST, MX zuletzt**).
- **Neu auf dem Server (alles optional, ohne sie läuft Gmail per Abfrage):** `GMAIL_PUBSUB_THEMA`, `GMAIL_PUSH_DIENSTKONTO`, `GMAIL_PUSH_AUDIENCE` — `deploy/google-verbinden.sh` fragt sie ab. Neue Bestände `gmail-stand--<person>`, `gmail-text--<person>`; neue Frist `mail-spiegel`; neues optionales Feld `Aktivitaet.mailLink`.
- **Rückweg:** nur neue Bestände und optionale Felder — Details `GO_LIVE_CHECKLISTE.md` › „Gmail in der Inbox“.

## Google Kalender für Business/MAKE (03.10.2026, nur lokal — Branch `google-kal`; Einrichtung `GOOGLE_KALENDER_EINRICHTEN.md`)

Kevin 03.10.: „Wir haben nur den Kalender bei Google für MAKE und alles andere läuft über MAKE OS.“ Business-/MAKE-Termine je Person ↔ Google Kalender der Person, in beide Richtungen, nahezu sofort; Privat/Familie/Gemeinsam bleiben MAKE OS + iCloud.

- **Allgemeine Google-Verbindung je Person** (`lib/google/*`): OAuth 2.0 Code + PKCE + `state`, inkrementelle Scopes je Funktion (`include_granted_scopes`) — Gmail o. Ä. kann später ohne zweite Verbindung andocken. Token nur serverseitig, verschlüsselt; Domain-Prüfung (`GOOGLE_ERLAUBTE_DOMAIN`); Trennen widerruft bei Google.
- **Abgleich:** `syncToken` (410 → voll neu), Serien/Ausnahmen/ganztägig/Zeitzonen (25.10.2026 getestet), Push per `events.watch` (Webhook mit Kanal-Token, Rückfall alle 5 Min.), Schreiben mit ETag (Google gewinnt bei Konflikt), Einladungen nur nach Klick, eigene Kennung `makeOsId`, Echo-Erkennung.
- **Zuordnung:** `kalenderZiel(person, art)` — Business → Google der Person, Privat/Gemeinsam → iCloud; Event-Spiegel, Netzwerken-Termin, Termin-Dialog (Business-Bereich) und Buchungsseite nutzen sie. Umzug bestehender Business-Termine aus iCloud: Vorschau + Sicherung + ausdrücklicher Klick.
- **Oberfläche:** Kalender › Einstellungen › „Google Kalender (MAKE)“ (verbinden, abgleichen, Kalender wählen, trennen, umziehen; am Handy bedienbar), Kalender „MAKE Kevin (Google)“ in eigener Farbe mit „G“, „letzter Abgleich vor X Min.“ je Quelle, Meet-Link am Termin.
- **Recht/Betrieb:** Register-Einträge, VVT „Kalender (Google Workspace)“, Art. 17 (Termine nennen die Person → in Google löschen), HOI-Befund, Glocke bei getrennter Verbindung.
- **Neu auf dem Server (optional, ohne sie ist die Funktion sichtbar aus):** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_ERLAUBTE_DOMAIN`, optional `GOOGLE_RUECKRUF_URL` — `deploy/google-verbinden.sh`.
- **Rückweg:** nur neue eigene Bestände und optionale Felder — Details `GO_LIVE_CHECKLISTE.md` › „Google Kalender“.

## Praxis-Funde behoben: Handy-Layout, wahre Texte, gelöschte Events, Kennzahlen (03.10.2026, nur lokal — Branch `praxis-fix`)

Die Praxis-Prüfung (Produktionsbau, Handy 375 px) fand Layout-Fehler und einige unwahre Texte; alles unten ist behoben und getestet (`tests/praxis-fix.test.ts`).

- **Handy-Layout (H1–H3):** „An Kunden übergeben“, Qualifizierung und Gesprächsmodus sind nicht mehr breiter als das Fenster — Ursache war die automatische Spaltenbreite des Grids (`Fenster` hat jetzt `minmax(0,1fr)`), dazu umbrechende Zeilen/Chips nur dort, wo es gebraucht wird (`Zeile`/`Chip` mit Prop `umbrechen`, nie global).
- **Wahre Texte (H4, Art. 13/14):** Der Danke-Entwurf unterscheidet **neu angelegt** („kennengelernt“, Visitenkarte, Weitergabe an den Kunden — nur bei neu Angelegten, nie bei Gesperrten) von **Bestandsperson** („wiedergesehen“, kein Visitenkarten-Satz, keine Ankündigung) und **gesprochen** von nicht gesprochen. „Gestern“ gilt für den Tag des Events, sonst steht „am 08.10.“. In der Kunden-CSV folgt die Herkunft dem Haken „persönlich gesprochen“; die Spalte „Werbe-Einwilligung“ sagt „keine (Visitenkarte, § 7 UWG)“ nur bei Visitenkarten-Erfassung, sonst den echten Stand der Kartei.
- **Firma zur Karte (M1):** Name gewinnt; die gleiche Mail-Domain gilt nur bei passendem Namen (ein anderer Firmenname = neue Firma), freie Anbieter nie. Server und Bestätigen-Schritt rechnen mit **derselben** Funktion (`firmaZurKarte`); ohne Firmennamen gibt es nur einen Vorschlag auf Klick (`firmaVorschlagAusDomain`).
- **Gelöschte Events (M2):** Jede Löschung merkt die Kennung 90 Tage (`events-geloescht`, Register-Eintrag). `eventNeu` einer wartenden Erfassung gilt nur für ein Event, das der Server nie hatte — sonst 404 mit `eventFehler` („Anderes Event wählen“).
- **Qualifizierung:** SQL-bereite Leads ohne Entscheidung bleiben oben in der Runde („SQL bereit — Entscheidung offen“, M3); beim Schließen des Gesprächs auf dem Ergebnis-Schirm kommt eine Rückfrage. „Firma wechseln“ bei Firmen-Lead mit mehreren Personen ohne Vorauswahl (M7). „Raus“/„Parken“ bei SQL oder Deal: Hinweis vorab, Knopf gesperrt (M8, eine Regel `ausscheidenGesperrt`).
- **Handy-Bedienung (M4–M6):** Tippziele ≥ 44 px und 16-px-Eingaben nur für die geprüften Bereiche (Klassen `.quali-flaeche`, `.quali-seite`, `.os-fenster`, `.deal-anlegen`, `.bes-akte`), die Aktionszeile der Runde lässt Platz für den ZOE-Knopf.
- **Kennzahlen besuchter Events (M10):** Ein Event mit Erfassungen zählt als besucht — unabhängig vom Datum (`zaehltAlsBesucht`). **Follow-up-Quote** = Anteil der erfassten Personen, bei denen innerhalb von 2 Tagen nach dem Event nachgefasst wurde (Follow-up, Termin, Gespräch, Danke-Mail raus); „Nur Kontakt“ (bewusster Verzicht) zählt nicht mit. Die Definition steht als Tooltip und unter den Kennzahlen.
- **Weiteres:** Liquiplanung-Hinweis mit direktem Link und deutschem Datum (M11); „Wir haben persönlich gesprochen“ steht sichtbar über „Weiter“ und im Bestätigen-Schritt, „Aus = keine Danke-Mail“ (M12); ein Abbrechen im Neues-Event-Formular; Streutext unter „Für wen“; Erklärung für „zu früh“ und „n offene Punkte“; E-Mail-Umbruch nach @ und Punkt; „Kennengelernt für“ nicht doppelt; Danke-Betreff und Text wachsen mit, „Datenschutzhinweis ist enthalten ✓“ steht darüber; Firmenakte sagt „angemeldet“ statt „besucht“ bei künftigem Event; Weitere Person: Besitzer ist die handelnde Person; Abgeben-Meldung mit Namen; Meldungs-Pop-up unter der Kopfzeile.
- **Rückweg:** reine Programm-Änderungen; neu nur der Bestand `events-geloescht` (additiv, der alte Stand ignoriert ihn).

## Mehrere Anmelde-Adressen je Konto (03.10.2026, nur lokal — Branch `konto-mail`)

Kevin 03.10.: Die neuen Firmen-Adressen @makeinnovation.de werden Standard, die alten sollen weitergehen — „wir können uns mit kevin@makeinnovation.de anmelden oder mit der alten Adresse, Malin umgekehrt genauso.“

- **Modell:** `Konto.email` bleibt die **Hauptadresse** (Anzeige: Begrüßung, Visitenkarten-Vorbefüllung, Team; alte Bilder lesen nur sie). Neu optional `Konto.weitereEmails` (höchstens 3, klein/getrimmt wie `emailSauber`). Alle Adressen führen ins selbe Konto — gleiches Passwort, gleicher zweiter Faktor. Alte Konten ohne das Feld gelten unverändert; ohne weitere Adressen steht das Feld gar nicht in `konten.json`.
- **Eine Suche:** `kontoMitAdresse`/`kontoZuEmail` (`lib/zugang/konten.ts`) für „Adresse → Konto“ — Anmelden (auch mit zweitem Faktor) nutzt sie; `adresseVergeben` prüft Eindeutigkeit über alle Konten (Haupt + weitere) und offene Einladungen (Beitreten, Einladen, Hinzufügen, jeweils in der Konten-Sperre).
- **Sicherheit:** die Anmelde-Bremse zählt das Paar IP + **Konto** (nicht den eingegebenen Text) — ein Alias verdoppelt die Versuche nicht; die IP-Bremse, die Code-Bremse je Konto und die einheitliche 401-Antwort bleiben.
- **Einstellungen:** System › Konto › Kachel „Anmelde-Adressen“ (Liste, Adresse hinzufügen, Als Hauptadresse, Entfernen; die Hauptadresse und damit nie die letzte lässt sich nicht entfernen). Jede Änderung nur mit dem aktuellen Passwort (Bremse `pw:<person>` wie „Passwort ändern“), nur für das eigene Konto (`POST /api/konto/adressen`, Dienstweg 403), protokolliert (Sicherheitsprotokoll mit maskierter Adresse, „Zuletzt:“ auf der Kontoseite) und als Glocken-Meldung („Sicherheit“) ans Konto.
- **Einladen:** optional die Adresse der eingeladenen Person — bis zum Ablauf reserviert und einzige zulässige Adresse beim Beitreten.
- **Rückweg:** nur optionale Felder — Details `GO_LIVE_CHECKLISTE.md` › Rückweg (vorher die gewünschte Adresse zur Hauptadresse machen).

## Qualifizierung & Scoring (03.10.2026, nur lokal — Branch `quali`)

Kevin 03.10.: „Beim Qualifizierungsbereich derbe reingehen — Karten sauber bearbeiten, Firma ändern, Kontakt zusammenführen … und das Leadscoring mit in die Markttraktion.“ Methode, Standard, Vorschlag und Begründung: **`SCORING.md`**.

- **Neue Struktur:** der Schnellknopf heißt „Qualifizierung & Scoring“ (Kennung/alte Links bleiben): Qualifizierung (Runde) · Scoring › Marketing (bis MQL) · Sales (MQL → SQL). Einstellungen im eigenen Bestand `crm-scoring` (Stand/409, Dienstweg 403, letzte 10 Fassungen), Editor mit Live-Vorschau („so würden deine aktuellen Leads eingestuft“), „Vorschlag übernehmen“ (mit Wirkung vorher/nachher), „Auf Standard zurück“, „Letzte Änderung zurücknehmen“. **Standard = bisherige Rechnung** (am 03.10. abgelöst durch den geschärften Vorschlag, siehe nächster Abschnitt; die alte Rechnung bleibt wählbar und ist weiter durch den Paritätstest bewiesen).
- **Eine Rechnung:** `lib/crm/scoring.ts` ersetzt die vier festen Teile; Leads-Liste, Runde, Akte (`leadZeileFuer`), Lifecycle-MQL, Segmente, Heads, ZOE und der SQL-Weg lesen dasselbe (`crm.scoring`). Kontaktakte › Über: „Score x · Sales y / Schwelle z — fehlt: …“ mit Sprung in die Runde.
- **Runde:** Seitenfenster rechts (am Handy Blatt von unten) mit voller Bearbeitung von Kontakt und Firma; je Karte nur Kontakt · Firma · Gespräch starten, Rest unter „Mehr ⋯“; Herkunft (Event + für welchen Kunden, Make.One, Kampagne, Empfehlung, Foto der Visitenkarte, Sprachnotiz, letzte Aktivität); Gesprächsmodus (Fragen der Reihe nach, Notizen nebenbei, Ergebnis SQL / weiter / parken / raus).
- **Werkzeuge:** Firma wechseln/neu (Jobwechsel · zusätzlich · Korrektur; Lead und offene Deals ziehen mit, Deals mit weiteren Personen bleiben — der Dialog sagt es vorher), Zusammenführen (Personen über die vorhandene Dubletten-Logik, Firmen neu mit Vorschau und Ablehnung bei Verweisen außerhalb), weitere Person (Hauptansprechpartner des Leads), Abgeben, Parken (Wiedervorlage + Follow-up, kommt zurück in die Runde), Raus (Grund-Art → Auswertung).
- **Neu im Code:** Absichtsprotokoll-Art `firma-umhaengen` (Abbruch nach jedem Schritt getestet), Bestand `crm-scoring`, optionale Felder `Lead.stufen`/`wiedervorlage`/`grundArt`/`hauptKontaktId`, Routen `/api/crm/scoring` und neue Aktionen in `/api/crm/lead`.
- **Rückweg:** nur optionale Felder und ein neuer Bestand — Details `GO_LIVE_CHECKLISTE.md` › Rückweg.

## Qualifizierung & Scoring II: Standard, MQL nur Marketing, Firmen-Sicherung (03.10.2026, nur lokal — Branch `quali2`)

Kevins Entscheidungen 03.10.: (1) „Sofort übernehmen, macht am meisten Sinn … wir müssen unsere Leads eh noch qualifizieren.“ (2) „MQL sind nur die Leads, die aus dem Marketing kommen. Wenn jemand auf dem Event kommt, ist es ein Lead, bis es durch die Qualifragen gekommen ist.“ (3) Firmen zusammenführen mit Archivkopie 30 Tage. Details: **`SCORING.md`**.

- **Standard = geschärfter Vorschlag** (Marketing 8 von 53, Sales 28 von 70, Muss Schmerz · Entscheider · Budget oder Zeitpunkt, Temperatur 5/12/25) für neue **und** bestehende Instanzen ohne gespeicherte Einstellungen; wer gespeichert hat, behält. „Auf Standard zurück“ führt dorthin; die alte Rechnung bleibt als Fassung **„Bisherige Rechnung (bis 03.10.)“** wählbar (API `aktion: 'bisherig'`, Etikett `bisherig`; `'vorschlag'` bleibt Alias von `'standard'`). Paritätstest läuft gegen die bisherige Rechnung. Neue Gesamtwerte/Temperaturen: die Leads-Liste „kalt“ beginnt jetzt unter 5 % (statt 25 %) — mehr Leads erscheinen in der Runde (gewollt).
- **MQL nur Marketing:** `istMarketingLead`/`marketingHerkunft` (`lib/crm/scoring.ts`): Website-Anfrage, Newsletter (Double-Opt-in), Kampagne (gestartet, nicht Direktansprache), Content/Leadmagnet, Anmeldung zu eigenem Event. Begegnung, Empfehlung, Direktansprache, Recherche, Bestand = „Lead · noch zu qualifizieren“ (kein MQL-Balken). Die Marketing-Schwelle (`SeitenErgebnis.gilt`) gilt nur für Marketing-Leads; Punkte werden weiter gerechnet (Wärme für die Reihenfolge). Lifecycle-Vorschlag, Leads-Zeile, Runde, Scoring-Vorschau, Heads (`marketing_lead`, `lifecycle.vorgeschlagen`), ZOE: dieselbe Funktion. Editor: Satz unter „Marketing-Scoring“.
- **Firmen zusammenführen:** Schritt `archiv` zuerst — verschlüsselte Sicherung `archiv/crm-vor-firmen-zusammenfuehren-<zeit>.json` (beide Firmen, betroffene Kontakte/Deals/Mandate/Angebote/Events/Follow-ups …), 30 Tage (Löschfrist `archiv-umzug`), Art. 17 räumt sie mit. Zurück: `POST /api/crm/firma-archiv` (nur Inhaber, Dienstweg 403): `liste` · `wiederherstellen` — nur, was seitdem unverändert ist. Dialog-Hinweis „Vor dem Zusammenführen wird eine Sicherung angelegt (30 Tage).“
- **Neu im Code:** `lib/crm/kanal.ts` (Kanal aus score.ts herausgelöst), Route `/api/crm/firma-archiv`, Tests `marketing-lead.test.ts`, `firma-archiv.test.ts`.
- **Rückweg:** keine Daten betroffen (Rechenregeln, eine Sicherungsdatei, ein Weg zurück) — Details `GO_LIVE_CHECKLISTE.md` › Rückweg › Qualifizierung & Scoring.

## Netzwerken ↔ Events ↔ Make.One: alles verbunden (03.10.2026, nur lokal — Branch `netz-verbind`)

Kevin: „alle Verbindungen nachziehen, alles muss miteinander verknüpft sein … die Kontakte und Informationen müssen sauber laufen.“ Kontakte von Kunden-Events „gehören immer auch uns“ — es gibt keine Sperre für eigene Akquise; die rechtliche Seite macht `netz-recht`.

- **Gelöschtes Event hängt keine Erfassung mehr (H1):** der Körper trägt IMMER `eventNeu` (Titel, Datum, Ort, für wen). Fehlt das Event beim Senden — auch wenn der Schritt „event“ schon abgehakt war —, legt der Server es daraus neu an
  (Meldung im Ergebnis); nur ohne `eventNeu` bleibt es beim 404 mit dem Merker `eventFehler`. In der Warteschlange erscheint dann **„Anderes Event wählen“** (`Warteschlange.eventWechseln`: Kennung, Titel, Datum, Ort, für wen werden umgeschrieben,
  neue Versuche). Ein abgesagtes Event lehnt die Erfassung ab (409, N4); `eventNeu.datum` über ein Jahr entfernt wird nicht angelegt (400).
- **`lokal` live (H2):** „wird beim Speichern angelegt“ gilt nur, solange das Event im geladenen Bestand fehlt (`lib/netzwerken/wahl.ts`). „Für wen“ ändern schreibt `eventNeu.fuer` aller Wartenden dieses Events mit um (`fuerUmschreiben`); hängen schon erfasste
  Personen am Event, fragt das Fenster nach („n Personen hängen dann an …“).
- **Event-Dubletten (M7):** gleicher normierter Titel + gleicher Tag unter anderer Kennung → der Server hängt die Erfassung an das vorhandene besuchte Event und meldet dessen Kennung (Journal merkt sie); „Heute bei“ zieht um. Beim Anlegen (Netzwerken, Events-Reiter): „Gibt es schon: …“ mit „Dieses Event nehmen“.
- **Make.One in beide Richtungen (H3):** die Vormerkung läuft über EINE Stelle (`gastVormerken`/`gastTeilnahme`, `lib/crm/eventplanung.ts`) — Server, Kontaktakte („Make.One einladen“) und Gästeliste: Einladungsweg nach Ampel, `einladenDurch`, **`Teilnahme.herkunft`**
  (`{ art: 'netzwerken', eventId, erfassungId }`, Chip „kam von <Event>“ in der Gästeliste mit Sprung in die Event-Akte) und der Stempel „nachgefasst“ an der Begegnung. Antwort und Abendbericht tragen den Link auf die Gästeliste; „offen“ kommt aus dem echten Stand
  (nur „vorgemerkt“ ist offen, `NetzwerkenAngabe.makeone`). **Werbesperre:** keine Vormerkung, kein Label, keine Aufgabe — Hinweis. **Personen-Schranke auch für Funktions-Änderungen:** `aendereCrm(b => …)` prüft neue Teilnahmen/Kampagnen-Personen/Zielpersonen
  (Art. 18 nie, Werbesperre nur bei Einladungen — „da“ bleibt erfassbar) → `PersonenSchrankeFehler` (409), nichts geschrieben.
- **Ein nächster Schritt statt doppeltem Nachfassen (M1):** „Nur Kontakt“ = bewusst ausgelassen (`nachfassenVerzichtet`), „Andere“/„Qualifizieren“ = nachgefasst; „Für dich“ und die Übergaben trennen **Gäste nachfassen** (Make.One) und **Begegnungen bei Events nachfassen**
  (Ziel: Events-Reiter); offene echte Follow-ups zählen nicht doppelt.
- **Eine Rechnung (M2):** die Kennzahl `netzwerken` ist aus den Make.One-Kennzahlen raus (Zahlen der besuchten Events nur in `besuchKennzahlen`); der Überblick zählt „Make.One-Abende“ und „besuchte Events“ getrennt und verlinkt richtig; Scoreboard und Traktion filtern besuchte Events.
- **Begegnung ist kein Make.One-Signal (M3):** Gästevorschlag und Lifecycle sagen „Kennengelernt bei <Event>“ statt „war schon bei einem Event“ / MQL.
- **Schnellsuche und ZOE (M4):** ⌘K findet Events (besucht = „Event“, Make.One getrennt, Link je nach Art); ZOE hat **`besuche_lage`** (Wirkung, Urteil, erfasste Personen mit offenen Punkten, ohne eingeschränkte), `crm_suche` kennzeichnet beides, `events_lage` bleibt bei Make.One.
- **Zusammenführen (M5):** Kalender-Bezüge (Termin ↔ Person/Gäste) und offene Erfassungen im Journal ziehen mit um. **Firma der Karte (M6):** eine bestehende Person ohne Firma bekommt sie; nennt die Karte eine andere, bleibt alles und es gibt den Hinweis „Karte nennt andere Firma: …“.
- **Event löschen räumt auf (M8):** Spiegel-Termin im Kalender (nur auf Klick, nie Dienstweg; geht es nicht, steht „bitte in Apple löschen“), Planposten in der Liquiplanung, Verweis der Deals (Quelle bleibt). **Kosten → Liquiplanung (M9):** Knopf in der Event-Akte.
- **Links (M10):** `eventLink(event)` (`lib/wege.ts`: besucht → Event-Akte, sonst Make.One); Links zu Angebot und Aufgabe; die Glocke an die andere Person springt zum erzeugten Objekt (Termin · Deal · Angebot · Aufgabe · Follow-up); „Event öffnen“ im Follow-up;
  die Umleitung auf die Event-Akte behält `r`.
- **Wirkung ehrlich (M12, M14):** Deals zählen nur mit Quelle Event oder (≤ 180 Tage) für eine dort NEU angelegte Person ohne andere Quelle; fürs Urteil nur nicht verlorene, keine Vermittlung ohne Wert; Berliner Tag; Übersicht/Kennzahlen nur wirklich besuchte Events.
  **`zielGetroffen`** zentral (Person über Kennung, Zielfirma über jede erfasste Person der Firma) + Zielerreichungsgrad. **Firmenakte (M15):** „Begegnungen bei Events“.
- **Sprachnotiz (M13):** „Sprachnotiz ohne Abschrift — anhören“ als offener Punkt im Abendbericht/Event-Akte mit Sprung zur Akte (keine KI-Transkription).
- **Kleinkram (N-Punkte und Technik-Nachtrag):** `istKontaktKennung` überall (Route, Säuberer); **Arbeitslisten** „Dublette prüfen“/„Lead prüfen“ (Befunde + Kartei-Ansichten); Kalender-Spiegel mit `Event.wer`, **`Event.bisDatum`** (mehrtägige Messen) und Hinweis „angemeldet, aber kein Termin im Kalender“ in Glocke/Heute;
  zweite Begegnung hängt an (`NetzwerkenAngabe.vorher`, Termin bleibt); Verbindungsprüfung kennt Ziele, „für wen“, Termin-Verweise; **Zielpersonen einzeln** auf dem aktuellen Stand (`aktion: 'ziel'`); „Für wen“: Firma muss es geben, Mandat muss zur Firma passen;
  Link: ohne Schema `https://`, http erlaubt, sonst sichtbare Ablehnung; „Neues Event“ öffnet die Akte nur bei Erfolg; echter Kalendertest für Daten (`istKalendertag`); SVG-Säuberer linear (kein 35-s-Block), `CSS_MAX` 20.000; Tastaturhöhe räumt auf; „Heute bei“ ohne Layout-Sprung (`useSyncExternalStore`); 44-px-Ziele in der Akte am Handy.
- **Rückweg:** neue optionale Felder (`Teilnahme.herkunft`, `NetzwerkenAngabe.makeone`/`vorher`, `Event.bisDatum`, Journal `eventId`) — der alte Stand verwirft sie beim nächsten Schreiben; Details `GO_LIVE_CHECKLISTE.md` › Rückweg.

## Netzwerken & Events — Recht: Interessenabwägung, Übermittlung an Kunden, Löschfristen (03.10.2026, nur lokal — Branch `netz-recht`)

Kevins Entscheidung 03.10.: Kontakte, die wir als Interim CSO / Head of Sales **für einen Kunden** erfassen, „gehören immer auch uns“ — MAKE ist eigener Verantwortlicher (Art. 6 Abs. 1 lit. f), keine Sperre für die eigene Akquise; die Weitergabe an den Kunden ist eine Übermittlung an einen Dritten. Doku und Interessenabwägung: `DATENSCHUTZ_NETZWERKEN.md`. **Hinweis, keine Rechtsberatung — anwaltlich gegenlesen lassen.**

- **Markierung am Kontakt:** `rechtsgrundlageNotiz` („LIA-Netzwerken v1“, nur bei neu angelegten Personen), `kennengelerntFuer` (Kunde, Event, Tag), `datenschutzInformiertAm` — nur der Server setzt sie; in der Kontaktakte › Recht sichtbar („kennengelernt für <Kunde> bei <Event>“, Datenschutzhinweis erteilt / „Heute persönlich erteilt“).
- **An Kunden übergeben** (Event-Akte, neuer Dialog): Vorschau — an diesem Event **neu angelegte** Personen gehen mit, **Bestandspersonen nur mit Haken je Person** (Anzahl der Ausgelassenen steht da), „noch nicht informiert“ ist markiert, gesperrte nie; Pflicht-Haken „Rolle und Vertrag mit dem Kunden geklärt“.
  CSV: Herkunft je Zeile aus den Daten, Telefon ohne Apostroph (streng geprüft), Berliner Tag, Spalte „Datenschutzhinweis erteilt“; nach dem Download „Nach der Weitergabe die Datei löschen.“ Protokoll mit **Empfänger, Dateiname, Kennungen, Haken**; der Browser kann es nicht setzen. Event löschen mit Übergaben: Warnung + Bestätigung, das Protokoll geht ins **Übergabe-Journal** (36 Monate).
  Die alten Texte „AVV nötig / Auftragsverarbeitung“ sind durch „Übermittlung, eigener Verantwortlicher; Rolle mit dem Anwalt klären“ ersetzt.
- **Art. 15/17/19:** Auskunft nennt „übergeben am … an <Kunde>“; der Lösch-Bericht sagt „Person wurde am … an <Kunde> übergeben — dort informieren (Art. 19)“ (die Mitteilung schickt ein Mensch).
- **Art. 13:** die Danke-Mail trägt am Ende den Datenschutzhinweis (bei Kunden-Events mit Empfänger); „Ist raus“ setzt `datenschutzInformiertAm` (zweiter Schreibvorgang wiederholbar). Ohne Mail/Gespräch: Bericht und Follow-up sagen „Datenschutzhinweis beim ersten Kontakt geben“. Selbstprüfung: „Information bei Veranstaltungs-Kontakten“, Verzeichnis prüft die neuen Verarbeitungen.
- **UWG:** beim Erfassen Haken „Wir haben persönlich gesprochen“ (Standard an; sonst kein Danke-Entwurf); fester Hinweis „Nur Dank und Verabredetes …“, Rückfrage vor „In Mail öffnen“ bei Angebot/Einladung/Newsletter/Rabatt; Danke-Mails nach 14 Tagen nicht mehr in Glocke/Heute; „Nicht senden“.
- **Hinweistexte (dezent):** Sprachnotiz („Nur eigene Notiz … § 201 StGB, keine sensiblen Angaben“), Foto („Nur die Visitenkarte fotografieren, keine Personen“), Info („keine sensiblen Angaben“), „Auch im Handy speichern“ („liegt dann in Apple Kontakte (iCloud) — Löschen und Auskunft dort selbst“).
- **VVT:** `vv-netzwerken`, `vv-besuche-kunde`, `vv-kunden-export` werden beim Öffnen von Stammdaten idempotent nachgetragen. **Löschfristen** (Stammdaten › Datenschutz, anpassbar): Kartenfoto 6 Monate, Sprachnotiz 90 Tage, Gesprächs-Info/Zielpersonen 12 Monate nach dem Event (automatisch);
  Netzwerken-Kontakte ohne Interaktion 12 Monate (nur Prüf-Aufgabe, in der bestehenden Löschfrist-Aufgabe); Übergabe-Protokolle 36 Monate.
- **Offline-Warteschlange:** im Browser nur noch **verschlüsselt** (AES-GCM, nicht exportierbarer Schlüssel); ab 14 Tagen „Erfassung vom … noch nicht gesendet: senden oder verwerfen“, nach 30 Tagen automatisch verworfen (mit Anzeige); Abmelden löscht nach Bestätigung auch Wartendes (klare Warnung).
- **Weitere Punkte:** Kampagnen mit Mail/LinkedIn lehnen Personen mit roter Ampel ab, gelbe nur mit Hinweis · Zielpersonen, die später gesperrt werden, stehen ausgegraut („gesperrt“) · Telegram-Meldungen zu Netzwerken ohne Namen („Neue Person zugeteilt — Details in MAKE OS“, der Haken bleibt aus) ·
  KI-Transkript der Sprachnotiz vorbereitet, **aus** (`TRANSKRIPTION_AN` am Server, erst mit AVV/SCC des Anbieters) · Fotos verlieren Exif/GPS (Browser-Rückfall und Server) · Website-Entwurf `website/datenschutz.html#kontakte` (Platzhalter, **nicht veröffentlicht**).
- **Rückweg:** nur optionale Felder; der alte Stand verwirft sie beim nächsten Schreiben desselben Eintrags — Details `GO_LIVE_CHECKLISTE.md` › Rückweg.
- **Was Kevin außerhalb der Software tun muss:** AVV/Verträge (Hetzner, Microsoft, Apple, Anthropic; Vertrag mit dem Kunden und die Rolle klären) · Datenschutzerklärung freigeben (Platzhalter in `website/datenschutz.html`) · VVT als Dokument ablegen · Interessenabwägung anwaltlich prüfen · Pflichtangaben in der Mail-Signatur · Geräteregel für Handys.

## Events (besuchte Veranstaltungen) neben Make.One (03.10.2026, nur lokal — Branch `events`)

Kevin 03.10.: „Einmal wirklich Make.One und daneben das ganze Thema Events. Dann verbinden wir die beiden Sachen. Dann können auch die Events sauber vernetzt werden, auch wenn wir für Kunden unterwegs sind.“

- **Aufteilung:** Markttraktion rechts: Sales · Marketing · **Events** (neu, Kennung `besuche`) · **Make.One** (Kennung `event`, unverändert) · Stammdaten. Make.One zeigt nur noch unsere eigenen Abende
  (Liste, Nachfassen, Wirkung, Kachel „Nächstes Event“ auf der Startseite filtern besuchte Events heraus). Events = alle Veranstaltungen, die wir **besuchen**, samt Netzwerken (ein Datenbestand:
  besuchte Events sind Events mit `marke: Netzwerken`, bestehende Daten bleiben gültig). Alte Links bleiben gültig: `?s=event`, `?s=events` und `/os/crm?s=events` öffnen Make.One; ein Link auf ein
  BESUCHTES Event (`?s=event&k=…`, z. B. aus Kontaktakte, Deal, Verbindungsprüfung) leitet in die Event-Akte um. *(Die Kennung des neuen Reiters ist `besuche`, nicht `events` — `events` ist der alte Name von Make.One und per Test festgeschrieben.)*
- **Events › Kalender · Wirkung · Für Kunden** (Pillen, `a=wirkung|kunden`, Event-Akte über `k=<Event>`): Kalender mit anstehenden/vergangenen besuchten Events (Anmeldestand geplant · angemeldet · abgesagt · besucht,
  Kosten, wer von uns hingeht, Ort/Datum/Link, „für Kunde X“), unsere Make.One-Abende dazwischen nur lesend (ein Tipp öffnet Make.One). „+ Event“ = Name, Datum, Ort, für wen, wer geht hin.
  **Im MAKE-OS-Kalender** erscheint ein Event über den schon vorhandenen Weg der Make.One-Events: Knopf „Termin anlegen (Kalender Gemeinsam)“ in der Event-Akte (`events/Kalender.tsx` → `POST /api/kalender/spiegel`, echte UID,
  Änderungen/Absage ziehen nach) — nichts wird still angelegt. Der Anmeldestand zieht `status` mit (`anmeldungPatch`), damit Spiegel, Heads und Kennzahlen dasselbe sehen.
- **Event-Akte** (`components/os/crm/besuche/BesuchAkte.tsx`): Kopf (Anmeldung, Wann & wo, Link, **für wen**, wer geht, Kosten, Kalender) · Ziel (Freitext, `Event.ziel`) und **Zielpersonen/-firmen** aus der Kartei per Suche
  („wen wollen wir treffen“, beim Event abhaken; wer über Netzwerken erfasst wird, gilt automatisch als getroffen; Art.-18-Personen nie, Server-Schranke) · erfasste Personen (mit Sprüngen zu Person, Termin, Deal, Follow-up)
  · Wirkung · bei einem Kunden „An Kunden übergeben“. Hauptaktion: **„Jetzt erfassen“** → Netzwerken mit diesem Event vorgewählt (`/os/netzwerken?event=<id>`).
- **Netzwerken:** „Heute bei“ bietet die Events aus dem Event-Kalender an — erst **Heute**, dann **In den nächsten Tagen** (besuchte, 2 Tage zurück bis 7 voraus), der Rest über die Suche (`heuteBeiAngebot`). Ein neues Event dort
  landet im Kalender, „für wen“ (MAKE selbst / Kunde per Suche) ist beim Anlegen wählbar und am gewählten Event änderbar; jede Erfassung erbt es. Abendbericht und Danke-Mails hängen am Event: von der Event-Akte
  „Abendbericht und Danke-Mails ›“, vom Abendbericht „Event-Akte öffnen ›“. Wer bei einem „angemeldeten“ Event erfasst, setzt es auf „besucht“.
- **Für Kunden:** `Event.fuer` = MAKE selbst oder Kunde (Firma der Kartei, Mandat optional → Link in die Mandatsakte). Die Kontakte bleiben in unserer Kartei und sind dem Kunden über das Event zugeordnet; Auswertung je Kunde im
  Reiter „Für Kunden“, „Events für diesen Kunden“ in der Firmenakte, „besuchtes Event für <Kunde>“ in der Kontaktakte. **„An Kunden übergeben“** (`POST /api/crm/events { aktion: 'kunden-uebergabe' }`): CSV nur mit Feldern
  (Name, Firma, Position, Mail, Telefon, Mobil, LinkedIn, Webseite + Datum, Veranstaltung, Herkunft, Vermerk „keine Werbe-Einwilligung“), **nie** Fotos, Sprachnotizen, Gesprächsnotizen oder Kennungen, **nie** Personen mit Art. 18
  oder Werbesperre (gezählt und angezeigt, nicht verschwiegen), nur mit Sitzung (Dienstweg 403), Formel-Anfänge neutralisiert; jede Übergabe steht im Protokoll des Events (Tag, Person, Anzahl). Sichtbarer Hinweis überall: Kontakte für
  Kunden = Auftragsverarbeitung (Art. 28), AVV mit dem Kunden nötig; vor dem Export fragt ein Dialog danach.
- **Kennzahlen getrennt:** die Make.One-Kennzahlen bleiben ohne besuchte Events — neu auch **„Nachgefasst binnen 48 h“** (Kennzahl, Wochen-Scoreboard, Traktions-Index) rechnet nur noch die Gäste der eigenen Abende (vorher zählten
  Netzwerken-Erfassungen dort mit; das war die offene Entscheidung vom 03.10.). Besuchte Events haben **eigene Kennzahlen** (`besuchKennzahlen`, 90 Tage, nie im Score): besuchte Events, erfasste Kontakte, Follow-up-Quote,
  Termine · Deals, Kosten je Kontakt — und „Welche Events lohnen sich“ mit offenem Urteil ab 14 Tagen nach dem Event (lohnt sich = Deals da und Pipeline + Umsatz decken die Kosten; läuft; bisher ohne Folge; zu früh).
  Erfasste Kontakte, Deals und Umsatz zählen normal in Sales (Power Hour, Follow-up, Pipeline).
- **Datenschutz/Register:** `Event.zielpersonen` trägt Kontaktkennungen — Art. 17 (Person raus aus der Zielliste), Zusammenführen (alt → neu, „getroffen“ bleibt) und Art. 15 (`eventZiele` in der Auskunft) laufen über
  `lib/crm/person-verweise.ts`; Bestandsname bleibt `crm` (Register unverändert, Wächtertest grün). Löschsperre: eine Firma, für die ein Event läuft oder die Zielfirma ist, wird nicht gelöscht.
- **Rückweg:** keine Formänderung, nur optionale Felder; der alte Stand verliert sie beim nächsten Schreiben desselben Events — Details `GO_LIVE_CHECKLISTE.md` › Rückweg.
- **Bewusst nicht gebaut / Folgeschritte:** ZOE und die Heads kennen besuchte Events weiter nicht (der Bezug „ZOE fragen“ im Reiter Events zeigt auf die Event-Welt = Make.One); Event-Termin im Kalender nur per Klick in der
  Akte (kein Auto-Anlegen, kein Hinweis „kein Termin“ in der Glocke); kein Anlegen von Aufgaben/Checkliste für besuchte Events (die Make.One-Checkliste gibt es dort nicht); „Vorbereitung“ ist die Akte selbst, kein eigener Reiter;
  Kosten je Event als Pauschale (Euro), keine Kostenposten.

## Netzwerken · Kontakt auch ins Handy speichern (03.10.2026, nur lokal — Branch `netz-vcf`, auf `entwicklung` 359e7d5)

Kevin 03.10.: „Kontakt auch direkt aufs Handy speichern: geht ans CRM UND die Daten ins Handy.“ Alles im Browser, keine Daten an Dritte, keine neue Server-Route.

- **Erfassen › Fertig:** Knopf **„Auch im Handy speichern“** (Symbol Adressbuch). Baut aus den erfassten Feldern (Name, Firma, Position, Mail, Telefon, Handy, Website, Anschrift, LinkedIn) eine vCard 3.0 — derselbe Baustein wie bei „Meine Visitenkarte“ (`lib/netzwerken/karte.ts`, Escaping/UTF-8/Falten) — und teilt sie per Web Share mit `.vcf`-Datei (iOS: „Kontakt hinzufügen“); Rückfall: Download `name.vcf` (iOS Safari: Kontaktvorschau). Geht auch, solange die Erfassung noch in der Warteschlange wartet (die Daten liegen lokal vor).
- **Notiz im Handy-Kontakt:** nur „Kennengelernt bei <Event>, <Datum> · MAKE OS“ — nie Schritt, Zuständigkeit, Info oder Lead-Angaben.
- **Erfassen › Bestätigen:** Schalter „Auch im Handy speichern“ (je Gerät gemerkt, localStorage nur als Komfort). Teilen löst nie von selbst aus (iOS verlangt eine Nutzer-Geste): ist der Schalter an, steht der Knopf auf der Fertig-Ansicht hervorgehoben bereit.
- **Kontaktakte › Schnellleiste:** neuer Knopf **„Ins Handy“** für bestehende Kontakte (aus den Kartei-Daten, ohne Notiz). Eingeschränkte Personen (Art. 18): Knopf aus, Hinweis im Tooltip; in Erfassen zeigt sich der Grund direkt unter dem Schalter/Knopf.
- Neu: `lib/netzwerken/handy.ts`; `vcard()` kennt jetzt eine optionale `notiz` (NOTE). Test: `tests/netzwerken-handy.test.ts` (Felder, Escaping, Umlaute, Notiz ohne Internes, Art. 18, Teilen/Download, Knöpfe).

## Netzwerken — Korrekturen aus der Lese-Prüfung (03.10.2026, nur lokal — Branch `netz-fix`, auf `entwicklung` 7f61114)

Veranstaltung heute: die Prüfung fand echte Lücken im Fluss. Behoben, je mit Test (`tests/netzwerken-korrektur.test.ts`, `-abmelden.test.ts`, `-logik.test.ts`, `-route.test.ts`):

- **Offline-Warteschlange global senden:** `components/os/netzwerken/Sender.tsx` läuft auf JEDER /os-Seite (`app/os/layout.tsx`) und sendet beim Öffnen, bei `online`, wenn die Seite sichtbar wird und alle 30 s — ohne Erfassungen auf
  dem Gerät keine Anfrage. Eine geteilte Warteschlange je Browser (`geteilteWarteschlange`), Zähler-Abzeichen **„n warten“** (sonst „n Fehler“) am Netzwerken-Knopf der Handy-Leiste (`lib/netzwerken/zaehler.ts`).
  Serverfehler (5xx) an EINER Erfassung: drei Versuche, dann „Fehler“ mit Klartext — der Durchlauf geht mit der nächsten weiter; nur kein Netz (Status 0), 401 und 429 brechen ab. Pro Aufruf wird jede Erfassung höchstens einmal versucht.
- **Termin-Fehlerfall:** `terminAm`/`terminId` stehen erst NACH erfolgreichem Anlegen an der Teilnahme; Danke-Mail und Bericht nennen nie einen Termin, den es nicht gibt (Bericht: „Termin nicht angelegt“). Bei 409 `teilweise`
  (kein Kalender/iCloud) bietet die Oberfläche **„Ohne Termin abschließen (stattdessen Follow-up)“**: dieselbe Erfassung mit `ohneTermin` → Follow-up zum nächsten Werktag („Termin vereinbaren“), an der Teilnahme wird daraus „Follow-up“.
- **Telefon-Dublette:** gleiche Nummer führt nur bei gleichem Nachnamen zusammen, sonst neue Person + Hinweis „Gleiche Nummer wie …“.
- **Leads:** neue Netzwerken-Leads (ohne Lead oder „Neu“) werden „Kontaktiert“ (stehen in „In Arbeit“); „Qualifizieren“ bleibt „Qualifizierung“; bestehende aktive Status bleiben. **Firma ohne Vertrieb** (Dienstleister/Investor/Wettbewerber, Kein Fit, Ruht, SQL):
  Lead unverändert, Hinweis „Firma ist als … geführt — Lead nicht geändert“, Label „Lead prüfen“.
- **Event-Kennzahlen getrennt:** Events mit `marke: Netzwerken` (fremde Veranstaltung, `istNetzwerkenEvent`) zählen nicht in Erscheinensquote, Folgegespräche, Events 90 Tage, Gästemischung, Scoreboard „Durchgeführte Events“ und Traktions-Index; eigene Kennzahl
  `netzwerken` (nie im Score): „Netzwerken: n Kontakte, n Termine, n Follow-ups“ (90 Tage). Termin/Angebot/Vermitteln/Make.One setzen `followUpAm` = Erfassungstag (gilt als nachgefasst). **Offene Entscheidung:** die 48-h-Kennzahl rechnet Netzwerken-Gäste weiter mit
  (Frist ab Event-Datum, Tag der Begegnung) — Kevin entscheidet, ob sie ebenfalls getrennt werden soll. Ebenfalls offen: wer an einem EIGENEN Event spontan über Netzwerken als „da“ erfasst wird, zählt dort wie ein Gast mit Zusage.
- **Dubletten-Folgen:** keine verwaiste Firma, wenn die Erfassung an einer bestehenden Person hängt; Name + Firma ohne Beleg → neue Person, „Gibt es vermutlich schon“, Label „Dublette prüfen“; beim Anhängen (Mail/Nummer + Nachname oder „Diesen nehmen“)
  werden leere Felder (Telefon, Handy, Position, LinkedIn, Website) gefüllt, nichts überschrieben.
- **Rechtsgrundlage:** neue Person bekommt `rechtsgrundlage: 'berechtigt'` (B2B-Anbahnung) — weiterhin keine Einwilligung.
- **Erreichbarkeit:** der Server liefert alle Kennungen (`terminUid`+`terminTag`, `dealId`, `followupId`, `eventId`, `kontaktId`); Fertig-Seite und Abendbericht zeigen sie als Verknüpfungs-Chips (`ergebnisLinks`). Event › Gäste: bei Erfassten aus Netzwerken
  Schritt/Zuständig + Link „Abendbericht“. Schnellsuche: „Netzwerken“ und „Meine Visitenkarten“. Jede erfasste Person trägt das Label „Netzwerken“ (Kartei-Filter „Label: Netzwerken“).
- **Visitenkarten-Route:** Dienstweg → 403 wie `/api/netzwerken`; Tests laufen mit echter Sitzung (`x-make-user`).
- **Abmelden:** warnt „Es warten noch n Erfassungen — erst senden?“ (sendet; geht es nicht, zweite Frage „trotzdem abmelden?“); bei leerer Warteschlange fallen IndexedDB und `make-os-netzwerken-*` weg (`lib/netzwerken/abmelden.ts`). Erfassungen tragen
  `erfasstVon`; der Server lehnt Senden unter anderer Person mit 409 ab (nichts geschrieben), die Warteschlange hält sie für die richtige Person bereit.
- **Kleinkram:** Termin in der Vergangenheit abgelehnt (gemessen am Zeitpunkt der Erfassung, 15 Minuten Luft); der Hinweis unterscheidet „belegt“, „außerhalb der Arbeitszeit“ und „Feiertag“ (`terminKonflikt`).
- **Rückweg:** keine Formänderung; neue optionale Felder (`terminId`, Label, Rechtsgrundlage, `ohneTermin`/`erfasstVon` nur im Browser-Körper). Siehe `GO_LIVE_CHECKLISTE.md` › Rückweg.

## Netzwerken · Meine Visitenkarten, Handy-Leiste, Deal-Ebene am Handy (02.10.2026, nur lokal — Branch `netzwerken-b`)

Kevin/Malin 02.10.: Malin nutzt es unterwegs am iPhone. Paket B baut die Handy-Leiste, die eigenen Visitenkarten mit QR-Code und die Schnellaktionen am Kunden (Paket A baut die Seite `/os/netzwerken`).

- **Handy-Leiste unten:** „Melden“ ist durch **Netzwerken** (Handschlag, `lucide` Handshake) → `/os/netzwerken` ersetzt (`WEG.netzwerken`). „Problem oder Idee melden“ bleibt am Handy
  erreichbar: Zeile unten im Blatt von Privat/Business (`MeldenZeile`) und Knopf oben rechts auf der System-Seite. Am Rechner: „Netzwerken“ in der Seitenleiste (`EIGEN` in `lib/make-one/spaces.ts`).
- **Meine Visitenkarte** `/os/netzwerken/karte` (`components/os/netzwerken/MeineKarte.tsx`): je Person mehrere Profile (Name, Rolle, Firma, Mail, Handy, Telefon, Website, LinkedIn, Anschrift), oben
  „Unterwegs für: …“ (gemerkt), groß der **QR-Code als vCard 3.0** (UTF-8, nur die gesetzten Felder; im Browser erzeugt, `qrcode-generator`, kein Dienst), **Vollbild**, **vCard teilen** (Teilen-Menü
  mit .vcf, sonst Download). Speicher `visitenkarten--<person>` (Stand/409, Haushalts-Tor, `bauPruefen`, 413 statt Kürzen, Änderungsprotokoll ohne Werte; Register: eigene Daten des Haushalts).
- **Firmen-Design je Profil:** Logo (SVG wird gesäubert, PNG/JPG/WebP, ≤ ~200 KB), Hintergrund-, Text-, Akzentfarbe, Schrift (System · **Urbanist** lokal · Serif), Kontrastwarnung. Karte und Vollbild zeigen
  **nur dieses Design** — nichts von MAKE; der QR-Code steht immer dunkel auf weißem Feld. Wer nichts wählt, bekommt die neutrale Karte (weiß/schwarz).
- **Für andere anlegen:** die Inhaberin/der Inhaber wählt oben „Profile von: … “ und bereitet Profile für eine Person des Haushalts vor (`?fuer=<person>`, nur Inhaber, nur Haushalt, Protokoll mit `wer`).
- **Deal-Ebene am Handy:** in der Kontaktakte unter 1180 px eine mitlaufende **Schnellaktions-Leiste** (`components/os/crm/kontakt/SchnellLeiste.tsx`, Ziele ≥ 44 px): Anrufen (`tel:`) · Anruf festhalten ·
  Mail (Entwurf) · Termin · Notiz (mit Diktat) · Follow-up (= Aufgabe) · Qualifizieren (Lead-Status + Runde) · Vermitteln (Deal der Art Vermittlung) · Angebot · Make.One einladen (Gast fürs Event vormerken).
  Alles über die vorhandenen CRM-Wege; Sperren (Art. 18, Werbesperre, Ampel) wie am Rechner; es geht nichts raus ohne die bekannte Freigabe.
- **Meine Visitenkarte einrichten (Kurzanleitung):** 1) Handy: unten **Netzwerken** → **Meine Visitenkarte** (oder `/os/netzwerken/karte`). 2) **Erstes Profil anlegen** — „Aus meinem Konto übernehmen“ füllt Name und Mail,
  dazu Rolle, Firma, Handy. 3) Optional Design: Logo wählen, Farben, Schrift. 4) **Speichern**. 5) Unterwegs: **Vollbild** antippen, das Handy hinhalten — der Gegenüber scannt mit der Kamera und tippt „Kontakt speichern“.
  Mehrere Firmen: „+ Neues Profil“, oben bei „Unterwegs für:“ umschalten. Ohne Netz zeigt die Seite den zuletzt geladenen Stand (Offline-Abbild); Bearbeiten geht nur mit Verbindung. Abmelden räumt das Abbild weg.
- **Rückweg:** neuer eigener Bestand, bestehende Bestände unverändert (`GO_LIVE_CHECKLISTE.md` › Rückweg). Neue Abhängigkeit `qrcode-generator` (Dev `jsqr`), Schrift `public/schriften/urbanist-*.woff2` (OFL).
- **Tests:** `netzwerken-karte` (vCard, QR-Roundtrip mit jsQR, Prüfung, SVG-Säuberung, Kontrast), `netzwerken-route` (Haushalts-Tor, 409, 413, nur eigener Bestand, für andere), `netzwerken-ansicht` (keine MAKE-Marke in Karte/Vollbild),
  `netzwerken-schnellleiste`, `leiste-melden` (Netzwerken in der Leiste, Melden erreichbar).
## Netzwerken — Erfassen auf Veranstaltungen, handyzuerst (02.10.2026, nur lokal — Branch `netzwerken`, Paket A)

Kevin/Malin 02.10.: Malin ist morgen auf einer Netzwerkveranstaltung und nutzt MAKE OS am iPhone (Safari bzw. Home-Bildschirm-App). Neue Seite **`/os/netzwerken`**
(`WEG.netzwerken`): Visitenkarte fotografieren → Person erfassen → nächster Schritt → fertig, noch auf der Veranstaltung. Die Handy-Leiste („Netzwerken“-Knopf) und „Meine Karte (QR)“
(`/os/netzwerken/karte`) baut Paket B; die Seite verlinkt oben schon dorthin.

**Kurzanleitung für Malin (auf dem iPhone)**
1. `/os/netzwerken` öffnen (am besten zum Home-Bildschirm hinzufügen). Oben **„Heute bei“** antippen: ein vorhandenes Event wählen oder **+ Neues Event** (Name, Datum heute, Ort optional).
2. **Visitenkarte fotografieren** → „Rückseite fotografieren“ oder „Überspringen“ (mehrere Fotos gehen: „+ weiteres Foto“; Foto antippen = groß).
3. **Felder** ausfüllen (Nachname ist Pflicht; Vorwahl bei Telefon). Taucht eine gleiche Person auf: gelbe Karte **„Kennen wir schon: … zuständig … zuletzt …“** →
   **Diesen nehmen** (dann hängt alles an der bestehenden Person) oder **Trotzdem neu**. Du/Sie-Anrede wählen.
4. **Weiter** → **nächster Schritt** (Pflicht): Termin · Qualifizieren · Follow-up · Vermitteln · Andere · Angebot schicken · Zu Make.One einladen · Nur Kontakt.
   Dazu **Wer ist zuständig** (du oder die andere Person — sie bekommt eine Meldung und ein Pop-up) und **Info**: tippen, diktieren (Mikrofon-Taste der iPhone-Tastatur)
   oder **Sprachnotiz aufnehmen** (die Abschrift folgt später per KI).
   Beim **Termin**: Art (Kennenlerngespräch · Telefonat · Videocall), Dauer (30/45/60) und die **freien Zeiten der zuständigen Person** antippen — der Termin landet in DEREN Kalender, ohne Gäste (die Einladung schickst du später per Klick am Termin).
5. **Bestätigen und speichern.** Ohne Netz: „Wird gesendet, sobald Netz da ist“ — bleibt auf dem Gerät und geht von selbst raus, nie doppelt. Ein gelber Streifen oben zeigt, was noch wartet.
6. **Abends/Morgen:** Reiter **Heute** = Abendbericht (wen, welcher Schritt, wer zuständig, was offen ist). Ab dem **Folgetag** liegt je Person mit E-Mail ein **Danke-Mail-Entwurf** bereit (Du/Sie wählbar):
   **In Mail öffnen** startet die Mail-App mit dem fertigen Text, gesendet wird dort per Klick; danach **Ist raus**. Die Glocke sagt „n Danke-Mails bereit“.

- **Eine Erfassung = ein Serverlauf** (`POST /api/netzwerken`, `lib/crm/netzwerken-server.ts`, rein: `lib/crm/netzwerken.ts`): Schritte `event → firma → kontakt → dateien → teilnahme → verlauf → schritt → termin → melden`,
  jeder idempotent und einzeln im Journal abgehakt (`netzwerken-erfassungen--<haushalt>`, nur Zufalls-Kennung + Schrittnamen). Dieselbe Erfassung zweimal = nichts doppelt (Test: Abbruch vor/nach jedem Schritt),
  gleichzeitig gesendet = ein Lauf. Kontakt-Kennung ist `c-<Erfassungs-UUID>`, Termin-UID `makeos-t-nw-<UUID>`, Follow-up `fu-<UUID>`, Aufgabe `nw-<UUID>`, Deal `ch-nw-<UUID>`, Make.One-Teilnahme `t-nwm-<UUID>`, Angebots-Entwurf `ang-nw-<UUID>`.
- **Kontakt/Firma/Event über die vorhandenen Wege:** Quelle „Netzwerken“, Herkunft „Veranstaltung“, Typ „Netzwerk“, Beziehung bei der zuständigen Person, Sperrliste und Datenschutz-Stempel wie die Kartei-Route,
  Firma wird verknüpft (Name ohne Rechtsform/Domain) oder einmal neu angelegt; ein unterwegs angelegtes Event kommt über den Event-Schreibweg (`/api/crm/bestand`), ohne Netz legt es der Server mit der ersten Erfassung an
  (Marke „Netzwerken“). Teilnahme „da“ (`einladenDurch` = zuständig, `eingechecktVon` = Erfasser) — Event-Kennzahlen/Traktions-Index zählen, ein Event von heute gilt als durchgeführt.
- **Werbe-Einwilligung „keine“:** KEIN Eintrag in `einwilligungen` (jeder Eintrag würde die Kanal-Ampel grün schalten); Vermerk „Visitenkarte, keine Einwilligung (§ 7 UWG)“ in der Aktivität „Kennengelernt bei …“. Test: Ampel für Mail nie grün.
- **Dublette:** „Kennen wir schon?“ im Browser (tolerant: Mail, Telefon, Name ohne Titel/Umlaute, Firma ohne Rechtsform, 1–2 Buchstaben Abstand); zusätzlich serverseitig: gleiche Mail/Nummer ohne „Trotzdem neu“ legt keine zweite Person an. Art. 18 → 409.
- **Schritte:** Follow-up = echtes `FollowUp` (Frist wählbar, Standard +2 Werktage); Qualifizieren = Lead-Status „Qualifizierung“ (Firma, sonst Person; ein weiter fortgeschrittener Lead bleibt);
  **Vermitteln = Deal der Art „Vermittlung“** über den einen Anlageweg `dealAnlegen` (wie „Vermitteln“ in der Kontaktakte, Paket B; nächster Schritt „Vermitteln an …“, feste Kennung `ch-nw-<UUID>`; der Lead wird dabei wie überall SQL);
  **Zu Make.One einladen = Gast „vorgemerkt“** für ein wählbares KOMMENDES Event (wie in der Kontaktakte; Einladungsweg „Mail“ nur bei grüner Ampel, sonst „persönlich“; ohne wählbares Event Rückfall: Label „Make.One-Einladung“ + Aufgabe);
  Andere = Aufgabe mit Bezug zum Kontakt; Angebot = nur Entwurf im Angebots-Tool; Nur Kontakt = nichts; Termin = Kalender-Termin in der Zeitzone Berlin
  im Kalender der zuständigen Person (Kalender-Einstellungen; ohne Eintrag 409 „kein Kalender“ — die Person ist trotzdem erfasst) + Meeting-Aktivität (K3) + Hinweis bei Überschneidung.
- **Mitteilung an die andere Person:** gespeicherte Meldung der Art `netzwerken` (Termin gebucht bzw. Person zugeteilt; bei Aufgaben-Schritten meldet der Aufgaben-Weg schon „zugewiesen“), dazu das **Pop-up** (`NetzwerkenPopup`, in `app/os/layout.tsx`):
  einmal als Karte „Öffnen/OK“, danach gelesen. Läuft auf der Abfrage der Glocke (≤ 60 s).
- **Danke-Mails:** `Anstehend.danke` (Glocke „n Danke-Mails bereit“, Heute-Karte „Netzwerken“) — abgeleitet, nie gespeichert; Entwurf ohne Werbung; Versand NUR per Einzelklick (`mailto:`); „Ist raus“ vermerkt `Teilnahme.netzwerken.danke`, `followUpAm` (zählt als nachgefasst) und eine Mail-Aktivität ohne Folgen für Stufe/Wiedervorlage.
- **Fotos und Sprachnotiz** verschlüsselt in der Dateiablage am Kontakt (Art. 17 fällt mit der Person); Sprachnotiz-Typ aus dem Inhalt erkannt (`sprachnotizTypErkennen`), Aktivität „Sprachnotiz — Abschrift folgt (KI)“.
  `karteAuslesen(bilder)` ist vorbereitet und **aus** (`lib/crm/netzwerken-karte.ts`, `KARTE_AUSLESEN_AN`).
- **Offline:** IndexedDB-Warteschlange (`lib/netzwerken/warteschlange.ts`, Fotos als Base64), automatischer Wiederversuch beim Öffnen, bei `online`, wenn die Seite sichtbar wird und alle 30 s; 4xx bleibt als „Fehler“ mit Klartext (erneut/verwerfen), alter Tab (409 `neuLaden`) wartet.
- **Rückweg (Kompatibilitätsmodus):** nur optionale Zusatzfelder, neue Art, neuer Speicher. af4679a verwirft `Teilnahme.netzwerken` beim nächsten Speichern der Teilnahme (Bericht/Danke-Mail leer, Teilnahmen/Verlauf bleiben), kennt die Meldungsart `netzwerken`
  nicht (Meldungen verschwinden) und liest `netzwerken-erfassungen--*` nie (bleibt liegen). Fotos/Sprachnotizen bleiben in der Ablage. Siehe `GO_LIVE_CHECKLISTE.md` › Rückweg.
- **Speicher-Register:** `netzwerken-erfassungen--*` (kein Personenbezug, Kennungen nach Abschluss geleert, nie fertige nach 60 Tagen weg).
- **Tests:** `tests/netzwerken-erfassen.test.ts` (Server, CalDAV-Attrappe mit zwei Kalendern), `tests/netzwerken-logik.test.ts` (rein: Prüfung, Dublette, Danke, Bericht, Warteschlange, Glocke).
- **Offen:** Offline-Start der Seite braucht einmal Netz (kein Service Worker); automatisches Auslesen der Karte und die Abschrift der Sprachnotiz (KI) kommen in 1–2 Wochen; Danke-Mail-Versand aus MAKE OS selbst erst mit dem Postausgang (`VERSAND_PLAN.md`).

## Ziel ↔ Meilenstein: Kette mit Abhängigkeiten (01.10.2026, nur lokal — Branch `ziele`)

Kevin 01.10.: „Verknüpfe die Zielebene mit der Meilenstein-Ebene. Wir haben Ziele, und darunter kann man Meilensteine planen. Mehrere
Meilensteine zu einem Ziel, in Abhängigkeit.“ Der Ziel-Bezug (`zielId`, 30.09.) und der Ziel-Fortschritt als Mittelwert waren da — neu ist die Ebene dazwischen.

- **Ziel-Detail** `/os/planung/ziel/<id>` (`WEG.ziel`, `components/os/planung/ZielDetail.tsx`, Ziele aller Horizonte): Kopf (Titel, Horizont/Jahr, Frist,
  Bereich/Einheit, Messlatte, Beschreibung, Fortschritt aus den Meilensteinen), die Meilensteine als **geordnete Kette** (jeder nach seinen Vorgängern,
  parallele nebeneinander; Reihenfolge per ▲▼ oder Ziehen, eine Abhängigkeit geht vor), je Meilenstein Datum, Fortschritt, n/m Aufgaben, Status
  „dran / wartet / erledigt“, „+ danach“ und „+ Meilenstein zu diesem Ziel“ (das Meilenstein-Fenster, vorbelegt mit Ziel, Bereich, Einheit, Datum).
  Verlinkt: Ziel-Titel und Ziel-Bezug in Ziele & Planung, Brotkrumen „Ziele & Planung › Ziel › Meilenstein“, Zeitstrahl-Marker (◎ Ziel, Hover am Meilenstein).
- **Abhängigkeiten** `Meilenstein.wartetAuf` (optional, höchstens 10, keine Kreise — Kreislogik dieselbe wie bei Aufgaben): Schreibweg und ZOE lehnen Kreis,
  unbekannten Vorgänger und Grenze ab (409/413, nichts gespeichert); „wartet“ ist nur ein Anzeige-Status; liegt das Datum vor dem eines Vorgängers, warnt das
  Fenster (kein Blockieren); Frist im Kalender/Glocke/Heute sagt „… wartet noch auf …“. Fenster: Feld „Wartet auf“ (bevorzugt aus demselben Ziel, ohne Kreis-Kandidaten).
- **Verbindungen:** Meilenstein löschen räumt `wartetAuf` der anderen (Server in derselben Sperre; Rückgängig holt Verweise zurück); Ziel löschen löst nur
  `zielId` (Meilensteine bleiben, Hinweis + Rückgängig); Verbindungsprüfung `meilenstein-ziel-tot` / `meilenstein-wartet-tot` (reparierbar); ZOE `setze_meilenstein`
  kennt `ziel` und `wartet_auf` (nur über den Stapel); die Kaskade lässt `wartetAuf` am abgeleiteten Meilenstein stehen.
- **Rückweg:** af4679a verwirft `wartetAuf`, `messlatte` (Ziel) und `zielId` beim nächsten Speichern, sonst nichts (`GO_LIVE_CHECKLISTE.md` › Rückweg). Kein neuer Speicher.
- **Tests:** `tests/ziel-kette-0110.test.ts` (Fixture `tests/fixtures/alt-af4679a/meilensteine.ts`, `ziele.ts`).

## Finanzplanung: alle Felder anpassbar, Business-Blätter, Steuern aufgeräumt (02.10.2026, nur lokal — Branch `finanzen`)

Kevin 02.10.: „Businessplanung und die allgemeine fertig machen. Unten stehen so viele Steuern, die wir nicht brauchen. Alle Felder anpassbar.“
Details und Entscheidungen: `FINANZPLANUNG_JETZT.md` › „Alle Felder anpassbar …“. Rechenkern unverändert (Regressionstest gegen die Werte von 1818c5c).

- **Welche Steuern gelten?** je Gesellschaft: Rechtsform bestimmt die Zeilen (GmbH: KSt + Soli, Gewerbesteuer mit Hebesatz, USt nur als eingeklappter Durchlauf; Einzelunternehmen: Einkommensteuer; Privat: Netto-Tabelle),
  Schalter und Sätze editierbar, Nullzeilen hinter „n weitere Steuerzeilen“; Aufschlüsseln verteilt den Gesamtsatz, ohne eine Zahl zu ändern.
- **Business-Blatt je Gesellschaft** (MAKE Innovation GmbH · KD Ventures · Selbstständigkeit): Kacheln (Umsatz, Kosten, Ergebnis vor/nach Steuern, Break-even, Runway), Produkte frei anlegbar (leere Vorlagen), Kosten (Stelle · Software · Miete · Rate),
  Blatt je Monat mit Zelle-klicken-ändern auch für Produkte, Annahmen der Gesellschaft.
- **Allgemeine Planung:** „Noch offen in der Planung“ in der Lage, Warnungen nicht mehr doppelt, Übergänge (Gehälter, Ausschüttung) in Gesamt einstellbar, Netto-Tabelle, Stichtag, Reserve und alle Ampel-Schwellen als Felder, eine Frage je Unterseite, Handy ohne Seitenscroll.
- **Rückweg:** keine Formänderung bestehender Bestände, nur optionale Zusatzfelder — der Online-Stand (af4679a) verwirft sie beim nächsten Speichern (`GO_LIVE_CHECKLISTE.md` › Rückweg). Keine Zahl ändert sich.
- **Tests:** `finanzplan-regression`, `-steuern`, `-geschaeft`, `-felder-routen`, `-ansichten` (neu).

## Mehrstufige Unteraufgaben bis 5 Ebenen (01.10.2026, nur lokal — Branch `tiefe`)

Kevin 01.10.: „Wir brauchen nochmal Unteraufgaben, also bei dem HOS unter Produkten. Da müssen wir nochmal Beschreibungen machen können.“
`parentId` darf jetzt auf eine Unteraufgabe zeigen — bis `AUFGABEN_EBENEN_MAX` = 5 Ebenen (Hauptaufgabe = 1), jede Ebene mit vollem Detail.

- **Modell/Schreibweg** (`lib/aufgaben/ebenen.ts`, `speicher.ts`, `/api/tasks/create`): keine Formänderung; der Server lehnt zu tief (400), Kreis (409) und
  fehlendes Elternteil (400, create 404) mit klarer Meldung ab, nichts gespeichert. Kinder erben den Ort von der Hauptaufgabe, Umhängen zieht den Teilbaum
  mit. Die Übernahme heilt Altbestand (Kreis aufbrechen, zu tiefe Kette kappen) ohne Verlust.
- **Anzeige:** Baum (aufklappen je Ebene, n/m, „+ Unteraufgabe“ bis zur Grenze), Detail (Brotkrumen der Kette, direkte Unteraufgaben, Beschreibung auf
  jeder Ebene, umhängen/zur Hauptaufgabe machen), Schnell-Anlegen, Tabelle, Suche, Kalender, Meilenstein-Detail.
- **Logik rekursiv:** Erledigt-Rückfrage, Fortschritt/Meilenstein, Papierkorb/Wiederherstellen/Archiv/„Neu anfangen“, Serien, Vorlagen, „nur ich“,
  Verbindungsprüfung (2 neue Prüfungen), Brain-Spiegel; ZOE `create_task` mit `unter` (nur über den Stapel).
- **Rückweg:** der Online-Stand (zwei Ebenen) hängt tiefere Unteraufgaben beim nächsten Speichern an die oberste Aufgabe — Titel, Beschreibung, Notiz,
  Status bleiben, nur die Zwischenebene geht verloren (`GO_LIVE_CHECKLISTE.md` › Rückweg).
- **Tests:** `tests/aufgaben-ebenen.test.ts` (47), angepasst `aufgaben-struktur`, `aufgaben-vertiefung`, `crm-verbindungen`.

## Landingpage v3: Positionierung „Innovation in Deutschland fördern“ (01.10.2026, nur lokal — Branch `website-v3`)

Kevin 01.10.: „Wir wollen Innovation in Deutschland fördern — deshalb haben wir das Make.One-Netzwerk gegründet.“
Angebot: Markttraktion. Die Software kommt NICHT auf die Seite (weder Name noch Beschreibung), oben rechts nur „Login“.
Keine Kunden-/Firmennamen, keine Preise, Anrede Du. Look, Farben, Schriften, Knöpfe und Technik-Regeln wie v2.

- **Seite** `website/index.html`: Kopf (Markttraktion · Make.One · Make.Beteiligungen · Über uns · Kontakt, „Login“),
  Bühne, Für wen (3 Zielgruppen), Markttraktion (Interim CSO · Interim Head of Sales · Events & Netzwerk gleichwertig,
  Development als schmale „Coming Soon“-Zeile), So arbeiten wir (Analyse → Aufbau → Skalierung), Make.One (Einladung
  anfragen), Make.Beteiligungen (Projekt einreichen, „nur ganz wenige Kooperationen“, kein Anlage-/Finanzierungsangebot),
  Über uns, Erstgespräch, Kontakt. Hauptweg „Erstgespräch anfragen“ = vorbereitete Mail (Betreff „Erstgespräch –
  Markttraktion“); das Ziel steht an EINER Stelle (`#erstgespraech-link`), `js/erstgespraech.js` übernimmt es für alle
  Knöpfe mit `data-erstgespraech` — später mit einer Zeile auf die Buchungsseite umstellen (website/LIESMICH.md).
- **Logo** (`scripts/website-logo.mjs`): Bildmarke = M aus v2 mit geteiltem Punkt in der Mitte (links Grün, rechts Rot);
  Wortmarke = MAKE · roter + grüner Punkt · INNOVATION; neue Dateien `wortmarke(-hell).svg`; Entwürfe B/C entfallen.
- **Datenschutz/Impressum/404**: „Login“ statt Produktname, zweites Skript genannt.
- **Prüfung** `website/pruefen.mjs`: Sperrliste + Infinity, Name der Software im ganzen Ordner gesperrt, keine Preise,
  Angebote/Navigation/Mail-Betreffe, Ziel des Erstgesprächs genau einmal (Mail oder Buchungsseite mit gültigem Slug). Tests angepasst
  (`tests/website-landingpage.test.ts`, `tests/caddy-buchung-koepfe.test.ts`: Slug-Muster = `slugOk` der Software).

Offen vor Freigabe: ein Satz zu Kevins Vertriebserfahrung, Impressum-/Datenschutz-Angaben (website/LIESMICH.md).

## Landingpage v2: neues MAKE-Logo, Produkte, Markttraktion (01.10.2026, nur lokal — Branch `website-v2`)

Kevin: „Wir müssen die Landingpage anders aufbauen … das MAKE-Logo auf jeden Fall mega gut aufbauen … Als Produkte
Markttraktion, MAKE Innovation Development und Make.One unser Netzwerk.“ Danach präzisiert: Markttraktion und Make.One
aktiv, nur Development „Coming Soon“; Farben/UX wie v1; auf der Seite steht nur MAKE (keine anderen Firmen/Marken).

- **Logo** neu aus Linien auf einem Raster (`scripts/website-logo.mjs` → `website/assets/logo/*`, `website/favicon.svg`,
  Doku `website/assets/logo/LOGO.md`): Bildmarke = Logo F sauber konstruiert (Strich 24, 45°, Naht in der Fuge),
  Wortmarke MAKE (Strich 12) mit Personenstrichen, Zusatz INNOVATION (Strich 4); Fassungen quer/kompakt/groß, hell/dunkel,
  Favicon SVG + PNG 32/180/512. Drei Entwürfe (A Fuge · B Funke · C Kante) in `website/logo-entwuerfe.html` (nie ausgeliefert).
- **Seite** `website/index.html`: Kopf mit Logo + Menü (Handy: `<details>`, `js/menue.js` schließt es nur), Bühne mit
  sich zeichnender Bildmarke, Produkte (Markttraktion · Make.One aktiv mit Mail-Knopf, MAKE Innovation Development
  „Coming Soon“), Markttraktion vertieft (was es löst, Kreislauf, Traktions-Index 50/40/10, Bausteine, Datenschutz und
  Kontrolle), Über uns MA + KE, Ruf, Kontakt, Fuß mit Spalten. Bewegung nur ohne `prefers-reduced-motion`, ohne
  Scroll-Zeitleisten sofort sichtbar. Impressum/Datenschutz/404 mit neuem Kopf; Datenschutz nennt das Menü-Skript.
- **Prüfung** `website/pruefen.mjs`: Skripte nur als eigene Datei aus `js/` (ohne fetch/Speicher/Cookies), Logo-Dateien
  da, Bühne = `bildmarke.svg`, Produkte (genau ein „Coming Soon“), Sperrliste fremder Namen, Wortregeln, srcset.
  Caddy-Freigabe-Fassung: `@intern` + `hide` auch für `logo-entwuerfe.html` und `LOGO.md`, Cache für `/js/*` und
  `/assets/logo/*`. Tests `tests/website-landingpage.test.ts`, `tests/caddy-buchung-koepfe.test.ts`.

**Offen (Kevin):** Platzhalter Make.One (für wen, wie hinein) und Development (ein Satz) zusätzlich zu den v1-Platzhaltern;
Logo-Entwurf wählen (heute A). Online weiterhin erst nach Freigabe (website/LIESMICH.md).

## Domain makeinnovation.de + Landingpage der MAKE Innovation GmbH (01.10.2026, nur lokal — Branch `website`)

Kevin hat `makeinnovation.de` (IONOS) gekauft: Software unter `app.makeinnovation.de`, auf `makeinnovation.de` + `www`
eine Landingpage der MAKE Innovation GmbH mit „Anmelden“-Knopf — online erst nach Kevins Freigabe.

- **Landingpage** `website/` (statisch, kein JS, keine Cookies, kein Tracking, Schriften selbst gehostet, CI aus
  `lib/make-one/design.ts` + Logo F aus `homepage/`): `index.html` (Bühne „Zwei Welten. Ein System.“, Was wir machen,
  Gründer MA + KE, Kontakt `hello@makeinnovation.de`), `impressum.html` (§ 5 DDG), `datenschutz.html` (passend zum
  tatsächlichen Verhalten), `404.html`. Offene Angaben als gelbe `[[KEVIN: …]]`-Platzhalter — Liste in `website/LIESMICH.md`.
- **Freigabe-Prüfung** `node website/pruefen.mjs`: „nicht freigabefähig“, solange ein Platzhalter steht; prüft dazu
  CSP-Tauglichkeit (keine Skripte/Inline-Stile/fremden Quellen), Pflichtlinks und tote Links. Test:
  `tests/website-landingpage.test.ts`.
- **Caddy:** Software-Block unverändert `{$MAKE_OS_DOMAIN}` — `app.makeinnovation.de` kommt über die Server-.env
  (`MAKE_OS_DOMAIN` als kommagetrennte Liste, am 01.10. gesetzt). Neuer Block `makeinnovation.de, www.makeinnovation.de`
  **vorerst** `redir https://app.makeinnovation.de/anmelden 302`; Freigabe-Fassung (www → 301, `file_server` aus
  `/srv/website`, strenge CSP, 404, Caching) kommentiert darunter. `compose.yml`: Caddy bekommt `./website:/srv/website:ro`.
  `.dockerignore`: `website` (gehört nicht ins App-Bild). `tests/caddy-buchung-koepfe.test.ts` erweitert (Hosts,
  Umleitung, Freigabe-Fassung, keine Schwächung der Buchungsköpfe, aktive Freigabe nur bei grüner Prüfung).
- **Doku:** `DEPLOY.md` › „Domain makeinnovation.de“ (DNS, Reihenfolge, Zertifikate, Umstellung `MAKE_OS_ADRESSE` und
  ihre Folgen), `deploy/env.server.beispiel` (Liste in `MAKE_OS_DOMAIN`).

**Was nach dem Upload zu tun ist (nur auf Kevins Wort):** DNS bei IONOS setzen (A für `app`, `@`, `www`; Parkseiten-
und AAAA-Einträge entfernen) → nach dem Ausrollen `curl -sI https://makeinnovation.de` = 302 auf die Anmeldung,
`https://app.makeinnovation.de/anmelden` = 200 → erst dann `MAKE_OS_ADRESSE` umstellen (neue Anmeldung je Gerät,
OAuth-Rückruf bei Whoop/Microsoft, GitHub-Variable). Landingpage-Freigabe ist ein eigener, späterer Schritt.

## Meilensteine im Detail: Aufgaben, Verlauf, Dateien & Links, Notizen (30.09.2026, nur lokal)

Kevin: „Wenn wir neue Meilensteine aufmachen, müssen darin neue Untertasks erstellt werden, wir müssen dort Informationen teilen
können … ein Chat mit Kommentarfunktion für mich und Malin … das muss sauber in die Struktur genommen werden.“

- **Detailseite** `/os/planung/meilenstein/<id>` (nur über `WEG.meilenstein(id, r)`): Kopf mit Titel, Bereich/Firma, Datum, Ziel,
  Messlatte, Abhaken, Fortschritt; „bearbeiten“ öffnet das Meilenstein-Fenster des Zeitstrahls (Verschieben, Löschen mit
  „Rückgängig“ — kein zweites Formular). Reiter **Aufgaben · Verlauf · Dateien & Links · Notizen** (`?r=`), am Handy eine Spalte.
  Geöffnet wird sie über den Titel in Ziele & Planung, den Marker im Zeitstrahl (`oeffneMeilenstein`), „gehört zu Meilenstein …“
  an jeder Aufgabe und die Glocke.
- **Echte Aufgaben am Meilenstein:** Jeder Meilenstein hat automatisch eine **Liste** im Aufgaben-Bereich seiner Firma/Einheit:
  Space (Privat · Selbstständigkeit · KD Ventures · Gesellschaft `ug` · Mandant `m-<firma>` bei Mandat, sonst KD Ventures) →
  Projekt **„Meilensteine“** → Liste „<Titel>“ → Aufgabe → Unteraufgabe. Die Liste entsteht im Schreibweg des Meilensteins
  (auch Zeitstrahl-Schnellanlage und Kaskade), spätestens beim Öffnen. Die Aufgaben sind ganz normale Aufgaben (Heute, Kalender,
  Glocke, Aufgaben-Seite, Serien, Dateien, Kommentare …). Titel/Datum/Bereich ändern → die Liste zieht mit (auch mit ihren Aufgaben
  in einen anderen Space). Meilenstein gelöscht → Liste archiviert, Aufgaben bleiben; „Rückgängig“ holt Meilenstein + Liste zurück.
- **Fortschritt (eine Regel):** sobald ein Meilenstein Aufgaben hat, rechnet er sich aus ihnen (jede Hauptaufgabe zählt 1,
  sonst Anteil erledigter Unteraufgaben; „abgebrochen“, Papierkorb, Archiv zählen nicht) — sonst von Hand. Ziele mit
  Meilensteinen (`zielId`, bzw. aus der Kaskade) stehen auf dem Mittelwert ihrer Meilensteine. Der Server schreibt beides nach
  jedem Aufgaben-/Meilenstein-Schreiben nach (Brain, Risiko, Business-/Gesundheits-Index lesen es unverändert).
- **Verlauf (Chat):** Nachrichten, Antworten, eigene bearbeiten/entfernen (weich), @Erwähnung → Glocke („… hat dich am Meilenstein
  „X“ erwähnt“, Link in den Verlauf), Antwort → Glocke bei der Verfasserin. Fremde Nachrichten sind unveränderlich. Dasselbe
  Bauteil wie die Kommentare der Aufgaben (`components/os/austausch/BeitragsVerlauf.tsx`).
- **Dateien & Links:** Dateien in der verschlüsselten Aufgaben-Ablage an der Liste des Meilensteins (`listeId`), Links nur http(s).
  **Notizen:** Ziel · Hintergrund · Entscheidungen, beide bearbeiten, veralteter Stand → 409, kurzer Verlauf (wer/wann, nie Text).
- **ZOE:** `create_task` nimmt `meilenstein` (Aufgabe landet in seiner Liste), `setze_meilenstein` setzt keinen Fortschritt von
  Hand, wenn es Aufgaben gibt. Der Knopf „ZOE: zusammenfassen / nächste Schritte“ ist **noch nicht gebaut** (offen).
- **Tests:** `tests/meilenstein-aufgaben.test.ts` (Fortschritt, Liste je Space/Mandat, Verweis nur per Kennung, Ziel-Mittelwert,
  Verlauf/Erwähnung/Rechte/413/409, Links, Rückweg-Verträglichkeit, Register, Routen).
- **Rückweg:** GO_LIVE_CHECKLISTE.md › Rückweg.

**Prüfliste nach dem Upload:**
1. Ziele & Planung › Jahr: Meilenstein anlegen → Titel anklicken → Detailseite; Aufgaben › Space der Firma zeigt Projekt
   „Meilensteine“ mit der Liste.
2. Im Detail drei Aufgaben anlegen, eine mit zwei Unteraufgaben; eine Unteraufgabe und eine Aufgabe abhaken → Fortschritt 50 %,
   derselbe Wert in der Liste unter Ziele & Planung (dort ohne Schieberegler).
3. Aufgabe öffnen → „gehört zu Meilenstein …“ führt zurück.
4. Malin schreibt im Verlauf „@Kevin …“ → Kevins Glocke zeigt die Erwähnung, Klick springt in den Verlauf; Kevin kann Malins
   Nachricht nicht bearbeiten.
5. Datei anhängen, Link anlegen, Notiz speichern (zweites Fenster mit altem Stand → Hinweis „inzwischen geändert“).
6. „bearbeiten“ → Einheit wechseln → die Aufgaben stehen danach in der anderen Firma; Löschen → „Rückgängig“ → alles wieder da.
7. Handy (375 px): Kopf, Reiter und Verlauf ohne seitliches Rollen.

## Zeitstrahl bis Ende nächsten Jahres, Planen im nächsten Jahr, Meilensteine am Zeitstrahl (30.09.2026, nur lokal)

Kevin: „Ich muss immer in die Zukunft gucken und dann auch einen Zeitstrahl haben, damit ich bis Ende nächsten Jahres gucken und
planen kann.“ — „einzeln nach vorne und einzeln nach hinten scrollen“ — „dass wir die Meilensteine reinbekommen“.

- **Zeitstrahl (Jahr & Ziele):** Zeitraum-Wahl „Dieses Jahr · Bis Ende nächsten Jahres · Ab heute 18 Monate“, Standard **bis Ende
  nächsten Jahres** (Jan dieses – Dez nächstes Jahr). Das sichtbare Fenster sind ganze Monate (12/24/18, am Handy 6) und lässt
  sich ohne Grenze blättern: Pfeile ‹ › (Umschalt = Quartal), Tasten ← → (Zeitstrahl fokussiert), Umschalt+Mausrad bzw.
  Trackpad waagerecht, Ziehen/Wischen. Knopf „Heute“ springt zurück. Adresse: `?raum=` und `?ab=2026-10` (Neuladen behält die
  Stelle); die Wahl wird je Gerät gemerkt (`make-planung-raum`). Monatsachse mit Jahreswechsel (Trennlinie + Jahreszahl),
  Quartale als Bänder, HEUTE-Linie. Marker: Meilensteine (Erledigtes leise), Jahresziele mit Frist ohne eigenen Meilenstein,
  Projekt-Fristen. Viele Marker: bis 5 Reihen, der Rest als „+n“ (Klick zeigt die Liste) — nichts überlappt; jeder Marker hat den
  vollen Titel als Tooltip. Rechnung rein in `lib/planung/zeitstrahl.ts`, Zustand in `components/os/planung/useStrahlFenster.ts`.
- **Meilensteine anlegen am Zeitstrahl:** Klick auf eine Stelle (Tag unter dem Zeiger) oder „+ Meilenstein“ öffnet das Fenster,
  vorbelegt mit Datum, Bereich (Privat/Business) und Einheit aus dem aktiven Filter. Felder: Titel, Datum, Bereich, Einheit,
  Mandat (nur mit aktiven Mandaten), „Zahlt auf Ziel ein“ (neu: `zielId`), Fortschritt, erledigt, Messlatte. **„Speichern +
  nächster“** (bzw. Enter im Titel) lässt das Fenster offen, Datum/Bereich/Einheit bleiben stehen. Klick auf einen Marker (und
  ✎ bzw. das Datum in der Liste) öffnet Bearbeiten/Verschieben — EINE Stelle `oeffneMeilenstein` (für die spätere Detailseite).
  Löschen mit „Rückgängig“ (10 s, wie Aufgaben), auch für ✕ in der Liste. Geschrieben wird nur über den vorhandenen Schreibweg
  (PATCH `/api/state/meilensteine` mit Stand).
- **Planungsjahr:** Auswahl „2026 · jetzt · 2027 · + 2028“ (mind. laufendes + nächstes, belegte Jahre dazu), Adresse `?jahr=`.
  Jahresziele tragen optional `jahr` (fehlt = Jahr der Frist, sonst laufendes; der Schreibweg stempelt es). Nur Ziele des
  laufenden Jahres kaskadieren in Quartal/Monat/Woche/Tag; Termin-Ziele werden Meilensteine auch im nächsten Jahr. „Fokus des
  Jahres“ je Jahr (`business:jahr:2027`; das laufende Jahr steht zusätzlich unter dem alten Schlüssel). Forecast je Jahr:
  läuft · „beginnt in 3 Monaten“ (keine 0 %) · Ergebnis.
- **Verbindungen:** Business-/Gesundheits-Index zählen im Meilenstein-Kurs nur bis Ende des laufenden Jahres („n später
  geplant“); ZOE `setze_meilenstein` verschiebt (`faellig`, auch nächstes Jahr; abgeleitete werden „angepasst“), `setze_fokus`
  nimmt `jahr`; Brain nennt Daten außerhalb des laufenden Jahres mit Jahr; Kalender-Fristen verlinken direkt auf den Meilenstein
  (`?m=`), die Jahresseite springt dann in sein Jahr.
- **Tests:** `tests/planung-zeitstrahl.test.ts` (Fenster über den Jahreswechsel, 29.02., Standard, Grenzen der Adresse,
  Heute-Sprung, Jahr-Ableitung, Filter, Forecast, Stapeln, Fokus je Jahr, Kaskade), `tests/planung-naechstes-jahr.test.ts`
  (Routen + ZOE), `tests/business-index.test.ts` (Kurs ohne Geplantes).
- **Rückweg:** GO_LIVE_CHECKLISTE.md › Rückweg (was af4679a davon verwirft).

**Prüfliste nach dem Upload:**
1. Jahr & Ziele: Zeitstrahl zeigt Jan dieses bis Dez nächsten Jahres, „2027“ am Jahreswechsel, HEUTE-Linie; ‹ › blättert je Monat,
   Adresse zeigt `?ab=…`, Neuladen bleibt dort, „Heute“ springt zurück.
2. Klick in den Zeitstrahl bei einem Monat im nächsten Jahr → Fenster mit diesem Datum; zwei Meilensteine mit „Speichern +
   nächster“ anlegen → beide stehen im Zeitstrahl, Datum/Einheit blieben stehen.
3. Klick auf einen Marker → Bearbeiten; Datum ändern → Marker wandert; Löschen → „Rückgängig“ holt ihn zurück.
4. Planungsjahr „2027“: Forecast „beginnt in n Monaten“, Fokus des Jahres 2027 eigen, neues Jahresziel erscheint nur unter 2027.
5. Handy: Zeitstrahl 6 Monate, Wischen blättert, keine seitliche Rolle der Seite.
6. Business-Index › Meilenstein-Kurs: Meilensteine des nächsten Jahres ziehen nicht herunter („später geplant“).

## Umbenennung: MAKE OS UG → MAKE Innovation GmbH (30.09.2026, nur lokal)

Kevin: „Ändere bitte überall in der Software MAKE UG in MAKE Innovation GmbH.“ Gemeint ist die Gesellschaft mit der
Kennung `ug` (früher „Neue UG“, zuletzt „MAKE OS UG“). **Nicht** gemeint: die KD Ventures UG (kdv) — die bleibt eine UG.

- **Eine Quelle:** Der Name steht nur noch in `lib/einheiten.ts` (`UG_NAME` = „MAKE Innovation GmbH“, `UG_KURZ` = „MAKE“ für
  enge Stellen wie „Töpfe MAKE“, „Runway MAKE“, „MAKE frei“, Chips im Wochenplan). Alle Oberflächen, ZOE-Werkzeugtexte,
  Steuer-Hinweise, Finanzplanung, Cockpit, Filter und Fehlermeldungen beziehen ihn von dort.
- **Kennung bleibt:** `ug` in Daten, Spaces, FinanzOrt, Adressen (`?scope=ug`) und Code-Namen (`rechneUG`, `steuerUG`,
  `UG_FIRMA`) — keine Datenmigration. Der Rechenkern rechnet unverändert (nur zwei Anzeigetexte folgen dem Namen).
- **Alte Namen werden erkannt:** „MAKE OS UG“, „MAKE UG“, „Neue UG“, „UG“ (Liste `UG_ALTNAMEN`) gelten beim Lesen als `ug` und
  werden mit dem neuen Namen angezeigt — Aufgaben, Ziele/Meilensteine, Zeit je Einheit, Wochenplan-Blöcke, Widget-Einstellungen,
  Finanzplan-Konto. Gespeichert wird der neue Name beim nächsten Schreiben (nur der Text ändert sich, keine Form).
- **Gesellschaften-Stammdaten:** Ohne gespeicherte Firmierung gilt „MAKE Innovation GmbH“ als Vorschlag und Absender. Eine
  gespeicherte Firmierung wird nie still überschrieben — nennt sie noch eine UG, steht in Markttraktion › Stammdaten ›
  Gesellschaften der Hinweis „Firmierung noch als UG gespeichert — auf MAKE Innovation GmbH ändern?“ mit Knopf.
- **Nebenbei behoben:** Auf „Zahlen“ standen offene Belege der KD Ventures als „Selbstständigkeit“ — jetzt mit dem richtigen Namen.
- **Tests:** `tests/umbenennung-make.test.ts` (Altnamen → `ug` → neuer Name, KD Ventures UG bleibt kdv, Finanzplan-Konto,
  Widget-Einstellung, Gesellschaften-Hinweis, Wächter: „MAKE OS UG“ nur noch in `lib/einheiten.ts`, „MAKE Innovation GmbH“ in
  keinem Code außerhalb `lib/einheiten.ts`).

**Prüfliste nach dem Upload:**
1. Aufgaben › Business: Filter-Pille heißt „MAKE Innovation GmbH“, alte Aufgaben der UG sind darin (keine zweite Pille).
2. Finanzplanung › Business: Unterseite „MAKE Innovation GmbH“, Töpfe heißen „Töpfe MAKE“, Konto im Finanzplan zeigt den neuen Namen.
3. Finanzen › Steuern: Zeile „Steuern MAKE Innovation GmbH …“ mit „noch nicht hinterlegt“ (keine neue Steuerregel — UG und GmbH
   rechnen gleich).
4. Stammdaten › Gesellschaften: Karte „MAKE Innovation GmbH“; steht der Hinweis da, Firmierung per Knopf ändern.

**Hinweis für Kevin (selbst prüfen, nichts davon ist erfunden oder vorbelegt):** In den Gesellschaften-Stammdaten Firmierung,
**Registergericht + HRB-Nummer** (eine GmbH hat eine neue HRB bzw. einen geänderten Eintrag), Geschäftsführung, Steuernummer/
USt-IdNr., Bank/Kontoinhaber und Fußtext der MAKE Innovation GmbH prüfen. Das Angebots-Kürzel der Gesellschaft ist weiterhin
„MOS“ (Vorgabe) — wer ein anderes will (z. B. „MAKE“), trägt es dort unter „Kürzel“ ein; die laufende Nummer je Jahr bleibt.
Bausteine, die schon „Umsatz UG (Regler)“ heißen, behalten ihren gespeicherten Namen (neue heißen „Umsatz MAKE (Regler)“).

## Upload-Prüfung U1: Rückweg sicher, nichts ungefragt nach iCloud (29.09.2026 spät, nur lokal)

- **Familie stürzt im alten Stand nicht mehr ab:** Wichtige Tage mit Verweis auf einen Menschen tragen das Datum wieder mit
  (Kopie vom Menschen — gelesen wird weiter vom Menschen). Ohne das hätte ein Rückweg die Familie, die Startfläche und die
  Leistungsseite lahmgelegt.
- **Kalender beim ersten Takt ruhig:** Event-Termine werden nur nachgezogen, wenn MAKE OS sie selbst angelegt hat, nur künftige
  und nur, wenn sich das Event seitdem geändert hat — eine Änderung in Apple bleibt sonst stehen. Alte Event-Marken (`mac-…`)
  verknüpft nur ein Klick auf der Event-Seite. Ein abgesagtes Event löscht seinen Termin im Takt nie: die Glocke meldet es
  einmal, gelöscht wird per Klick („Termin im Kalender löschen“).
- **Wochenplan-Übernahme:** deutlicher Hinweis „erst nach ein paar stabilen Tagen“; Netz- oder Überlastfehler überspringen
  keinen Block mehr (die Übernahme macht später weiter); übersprungene Blöcke mit „Erneut versuchen“; neu „Übernahme
  zurücknehmen …“ (Probelauf, Rückfrage, löscht nur die Termine `makeos-wochenplan-…`) für den Rückweg.
- **Kalender-Sicherung:** nur Termine −400 … +800 Tage, nicht mehr im Nachtarchiv (14 Tage gelten wirklich), nur 03:00–05:00,
  frühestens 30 Minuten nach dem Start, nie während einer iCloud-Pause; die Kalender-Jobs im Takt laufen nacheinander.
- **Buchungsseite:** Caddy überschreibt ihre strengen Köpfe (kein Referrer, keine Kamera) nicht mehr.
- **Tests:** schreiben nie mehr in `<repo>/.data` (local-db bricht im Testlauf dort ab).

**Was Kevin nach dem Upload tun muss:** GO_LIVE_CHECKLISTE.md (Caddy neu laden, Kurztest). Wochenplan-Übernahme erst nach ein
paar stabilen Tagen. Alte Events mit Termin einzeln auf der Event-Seite verknüpfen, wenn die Verbindungsprüfung sie nennt.

## Prüfung 2 (F2): Nachbesserungen Heute, Glocke, Brain, ZOE (29.09.2026, nur lokal)

- **Zeit im Brain nur mit Einwilligung:** Der Wochenrückblick im Brain (`_App/Woche`) zeigt die Zeit einer Person erst, wenn sie
  selbst zustimmt (Standard: niemand). Jede Person entscheidet nur für sich.
- **Mandats-Review einmal:** Glocke und Heute zeigen es nur noch als Follow-up; ein pausiertes Mandat hat kein Review.
- **Geburtstage an einer Stelle:** Auf Heute nur noch in „Steht an“ (auch heutige). Familie: der Vorlauf kommt aus dem
  „Wichtigen Tag“ (mit „erledigt“ je Jahr); ohne ihn legt „Geschenk vormerken“ ihn an. CRM: „Geschenk-Aufgabe“ heißt nur noch
  „Geschenk für …“ und wird über den Kontakt erkannt, nicht über den Titel.
- **Follow-ups am Termin:** „Termin vorbereiten“ (Buchung) und „Nachbereiten“ (Akte) hängen am Termin — verschoben zieht mit,
  gelöscht meldet die Verbindungsprüfung („Vom Termin lösen“); „Wie lief’s?“ fragt nicht doppelt.
- **Abgesagte Termine** zählen für ZOE, das Brain und Blöcke nicht mehr; ganztägig abwesend = kein Block an dem Tag.
- **ZOE plant nur über den Stapel:** Blöcke landen als Vorschlag im Stapel, erst dein Klick trägt sie ein.
- **Kleinigkeiten:** Glocke ohne „Belegt“-Termine der anderen Person, Kalender-Einstellungen speichern nur Geänderte, der
  Text aus „Als Nächstes“ bei geparkten Deals bleibt in der Notiz, die ungenutzte Netzwerk-Verlauf-Schnittstelle ist weg.

**Prüfliste (lokal, Wegwerfdaten):** Mandat mit Review heute → Glocke genau eine Meldung. Familie: Mensch mit Geburtstag in
10 Tagen → Heute „Geschenk vormerken“ → Familie › Wichtige Tage hat den Eintrag. CRM-Kontakt mit Geburtstag → „Geschenk-Aufgabe“
→ Aufgabe „Geschenk für …“ mit Kontakt. ZOE „plane morgen 9 Uhr Fokus“ → Stapel → Freigeben → Block im Kalender.
Brain: POST /api/brain/app `{ zeitAuswertung: true }` → `_App/Woche` mit eigener Zeit.

## Kalender K6a: alles mit dem Kalender verbunden (29.09.2026, nur lokal — Commit c3d9f53)

- **Glocke und Heute wissen, was ansteht:** ein Termin meldet sich 2 Stunden vorher, Termine ohne festgehaltenes Ergebnis
  („Wie lief …?“), Fristen (Kündigungsfristen 14 Tage vorher, Zahlungen, DSGVO-Anträge, Angebote, Entscheidung eines Deals),
  fällige Follow-ups, Kalender-Vorschläge von ZOE. Auf Heute die neue Karte „Steht an“ — auch offene Buchungsanfragen und
  Geburtstage der nächsten 14 Tage mit „Geschenk-Aufgabe (10 Tage vorher)“ per Klick. Nichts wird kopiert — alles kommt aus
  den Modulen und führt dorthin.
- **Geparkte Deals kommen wieder:** Die Wiedervorlage steht als Follow-up in der Liste, in der Power Hour und in der Glocke.
  „Erledigt“ setzt die nächste Wiedervorlage (ohne Angabe in 90 Tagen), der Deal bleibt geparkt.
- **Meetings zeigen überall die Zeit des Termins** (Kontakt, ZOE, Heads) — verschoben heißt: neue Zeit.
- **Kündigungsfrist einmal gerechnet:** Mandate ohne festes Ende (Mindestlaufzeit, Verlängerung) haben ihre Frist jetzt auch im
  Kalender.
- **Steuertermine im Kalender (Vorlage, Standard aus):** im Steuer-Modul unter „Fristen“ einschaltbar — ohne Beträge, mit dem
  Hinweis „keine Steuerberatung; Termine gegen BMF-Steuerkalender prüfen“.
- **Angebot:** „Termin zum Besprechen vorschlagen“ zeigt die eigene freie Zeit; ein Klick öffnet den Termin-Entwurf mit Kontakt,
  Firma und Deal. ZOE kann freie Zeit nachsehen (nur lesen).
- **Verbindungsprüfung:** „Termin entfernen“ für Termine gelöschter Events (mit Rückfrage, nie mit Gästen), „Neu zuordnen“, wenn
  ein Termin in Apple gelöscht und gleich wieder angelegt wurde, „Nachziehen“ für Follow-ups an verschobenen Terminen.
- **Zeit-Auswertung** zählt Planen-Blöcke (Reha, Routine, Pause, Aufgabe, Blockzeit) als eigene Kategorie; der Wochenrückblick
  im Brain (`_App/Woche`) enthält die Zeit der Woche je Person (nur Zahlen, Firmen, Mandate).

**Prüfliste (vor dem Hochladen, lokal mit Wegwerfdaten):**
- Geparkten Deal mit Wiedervorlage heute anlegen → Follow-ups „Deal-Wiedervorlage“, Glocke „Überfällig/Heute: …“, Heute „Steht an“.
- Termin mit Kontakt heute in 1 h → Glocke „Um HH:MM: …“; nach dem Termin „Wie lief …?“ in Glocke, Heute und Power Hour.
- Mandat ohne Ende, Mindestlaufzeit 12 Monate, Kündigungsfrist 90 Tage → Frist im Kalender (Fristen) und 14 Tage vorher in der Glocke.
- Steuer-Modul › Fristen › „Steuertermine im Kalender zeigen“ an → Kalender-Fristen „¶“ mit Hinweis; aus → weg.
- Angebot mit Empfänger → „Termin zum Besprechen vorschlagen“ → Zeit wählen → Dialog vorbelegt, erst „Speichern“ legt an.
- Event löschen, dessen Termin im Kalender steht → Verbindungsprüfung „Termin entfernen“ → Vorschau → „Jetzt reparieren“.

## Kalender R-K1: Kern & Abgleich (29.09.2026, nur lokal)

- **Zeitumstellung stimmt:** Termine zwischen 02:00 und 03:59 am 25.10. und 29.03. werden richtig geschrieben und gelesen
  (vorher wurde 02:00–03:00 am 25.10. zu einem Termin ohne Dauer). Termine aus Outlook (Windows-Zonen), Abos und
  weitergeleiteten Einladungen ohne Zonen-Angabe stehen zur richtigen Berliner Zeit.
- **Gleicher Termin in zwei Kalendern** (z. B. in Apple kopiert) sind zwei Termine; Ändern trifft den richtigen.
- **Abgesagte oder selbst abgelehnte Einladungen** blockieren weder freie Zeit noch Buchungsseite und zählen im CRM nicht.
- **Abgleich robuster:** Ein gesperrter geteilter Kalender stoppt nicht mehr den ganzen Abgleich; bei Überlastung wartet
  MAKE OS, wie Apple es verlangt; der HOI meldet, wenn der Kalender-Stand älter als 30 Minuten ist.
- **Tägliche Kalender-Sicherung** (nachts, verschlüsselt, 14 Tage je Kalender) — zurückspielen nur mit Probelauf und Klick,
  nie Termine mit Gästen.

**Was Kevin nach dem Upload tun muss:** nichts. (Online gibt es noch keine Kalender-Verknüpfungen — `kalender-bezug` entsteht
erst mit diesem Upload; das Umziehen alter Schlüssel betrifft nur Stände, die schon mit dem neuen Format liefen.)

**Prüfliste (vor dem Hochladen, lokal mit Wegwerfdaten):**
- Termin am 25.10. 02:00–03:00 anlegen → steht 02:00–03:00 im Raster und in Apple.
- Termin im Kalender ändern und löschen (Einzeltermin und Serie mit Bezug) → wie bisher, keine 409.
- HOI-Seite: Befund „iCloud-Kalender“ grün; am Folgetag Befund „Kalender-Sicherung“ grün.

## Kalender K5: Ein Kalender — Planen als Modus, Aufgaben-Modus (29.09.2026, nur lokal — Commit 55866be)

- **Ein Kalender:** Der Wochenplaner ist jetzt der Modus „Planen“ im Kalender (`/os/kalender?modus=planen`, Taste p).
  Bausteine (Fokus, Reha, Pause, Blockzeit), Routinen, Aufgaben und eigene Blöcke antippen, dann in den Kalender klicken
  oder aufziehen — jeder Block ist ein Termin in iCloud (auf allen Geräten); verschieben/löschen zieht Apple mit. Oben die
  Stunden des Zeitraums (h belegt · Termine · Blöcke) und je Tag. Alte Links (`/os/planung/woche`, Kennzahl-Links) leiten um;
  der Kopf-Knopf „Kalender“ öffnet den Kalender.
- **Umschalter Kalender | Aufgaben** oben rechts (wie Google): Aufgaben nach Fälligkeit (Überfällig · Heute · Diese Woche ·
  Später · Ohne Datum), abhaken, einplanen (Datum/Uhrzeit oder auf einen Tag ziehen). Derselbe Umschalter in den Aufgaben.
- **Make.One-Events und Familie** (Dates, Paar-Gespräch) legen echte Termine an; Datum ändern oder absagen zieht den Termin
  im Kalender „Gemeinsam“ nach bzw. löscht ihn.
- **Aufgeräumt:** das alte Kalender-Dashboard `/calendar` (Beispieldaten, verursachte Fehler auf der Anmeldeseite) ist weg,
  die festen KEMARIS-Beispieltermine (Juli 2026) tauchen nirgends mehr auf.

**Was Kevin nach dem Upload tun muss (einmal):**
1. **Übernahme der Wochenplan-Blöcke — NICHT am ersten Tag, erst nach ein paar stabilen Tagen** (danach ist der Rückweg zur
   alten Version nur mit „Übernahme zurücknehmen“ möglich, U1): Kalender → „Planen“ → links die Karte „Alter Wochenplan“ →
   Vorschau ansehen → „Jetzt übernehmen“. Künftige Blöcke werden Termine in iCloud (vorhandene Apple-Kopien werden zum Block,
   nicht doppelt), vorher legt MAKE OS eine Archivkopie ab; vergangene Blöcke bleiben als Archiv lesbar. Bricht es an iCloud
   ab, macht der Takt es fertig; übersprungene Blöcke → „Erneut versuchen“. (Solange nicht übernommen, stehen die alten Blöcke
   gestrichelt „wartet auf Übernahme“ im Raster.)
2. Alte Make.One-Events mit Termin: die Verbindungsprüfung nennt sie — verknüpft wird NUR per Klick auf der Event-Seite
   („Mit dem Kalender verknüpfen“), nie von selbst (U1).

**Prüfliste (vor dem Hochladen, lokal mit Wegwerfdaten):**
- `/os/planung/woche` → landet im Kalender, Modus Planen, Woche. Baustein antippen → in den Kalender klicken → Block steht
  (in Apple mit Art), verschieben zieht Apple mit, löschen fragt.
- Umschalter ✓-Symbol → Aufgaben-Liste; „Einplanen“ setzt Datum/Uhrzeit, die Aufgabe springt in die richtige Gruppe.
- Event mit Uhrzeit → „Termin anlegen“ → Datum ändern → Termin im Kalender wandert mit; „Abgesagt“ → Termin weg.
- `/anmelden` ohne Sitzung: keine 401/500 mehr in der Konsole.

## Upload umkehrbar: Kompatibilitätsmodus (29.09.2026 abends, nur lokal)

- **Neuer Schalter `MAKE_OS_FORMAT`** (Standard ohne Variable: `kompatibel`). Die neue Version schreibt dann genau im Format
  des heutigen Online-Stands (v1-Hülle, „MKOSDAT1“, kein `_v`; Sperrliste neue Einträge v1 + v2, keine Umrechnung) — der
  alte Stand kann alles lesen, ein Rückweg geht ohne Sicherung. HOI gelb „Kompatibilitätsmodus“.
- **Nach stabilen Tagen** auf v2 umstellen: `.env` `MAKE_OS_FORMAT=v2` + `docker compose up -d` (+ optional Skript
  `--verschluesseln` bei angehaltener App). Danach zurück nur per Sicherung. Anleitung: DEPLOY.md › Schreibformat,
  NOTFALL.md › Rückweg. Bis dahin: Schlüssel in der `.env` lassen, kein Kennungs-Umzug, keine Rotation.

## Go-Live-Prüfung: Nachbesserungen (29.09.2026, nur lokal — Commits f6a7901 + Doku)

- **ZOE-Bestände bleiben lesbar:** Dateien, die noch `jarvis-…` heißen, werden beim ersten Lesen als `zoe-…` übernommen und
  dabei mit dem neuen Namen neu verschlüsselt (vorher nur umbenannt — mit der Verschlüsselung v2 wären sie danach
  unlesbar gewesen). Schon umbenannte Dateien mit altem Namen in der Verschlüsselung werden gelesen und von selbst
  umgestellt; `scripts/daten-verschluesselung.mjs` benennt `jarvis-…` vor dem Verschlüsseln selbst um.
- **Die Nachtsicherung fällt nie ganz aus:** fehlt am Server age oder `sicherung.pub`, sichert sie mit dem bisherigen
  openssl-Weg und `/srv/make-os/.sicherung-passwort` (`.tar.gz.enc`, wie der heutige Online-Stand) — Head of IT rot „age fehlt —
  Sicherung nur mit Übergangs-Verschlüsselung“, Ping an Healthchecks als Fehler. Fehlt auch das Passwort: keine Sicherung
  (nie unverschlüsselt), HOI rot. Ist bei der Prüfung eine einzelne Datei nicht lesbar, bleibt das Archiv trotzdem liegen:
  HOI rot „teilweise“ mit den Dateinamen (keine Inhalte), Ping als Fehler. Probe-Restore, Mac-Abholung und
  `wiederherstellen.sh` lesen beide Formate.
- **Alte Browser-Tabs** bekommen nach dem Upload beim Speichern: „MAKE OS wurde gerade aktualisiert. Bitte die Seite neu laden.
  Die letzte Eingabe wurde nicht gespeichert — bitte danach noch einmal eingeben.“ Neue Tabs sagen zusätzlich, dass offene
  Aufgaben-Änderungen gemerkt bleiben (CRM-Eingaben nicht).

### Go-Live: VOR dem Upload am Server (einzige Anleitung — die Pakete unten verweisen hierher)
1. **Grabstein-Ordner** (Art. 17): `ssh make@2.28.108.162 'sudo install -d -m 700 -o make -g make /srv/make-os/grabsteine'`.
   Volume und `MAKE_OS_GRABSTEINE_DIR=/grabsteine` setzt `compose.yml` — in der `.env` **nichts** eintragen. Ohne den Ordner
   legt Docker ihn als root an und Grabsteine scheitern (Warnung beim Löschen).
2. **age für die Nachtsicherung:**
   - am Server: `ssh make@2.28.108.162 'command -v age || sudo apt-get install -y age'`
   - am Mac: `brew install age` → `age-keygen -o ~/make-os-sicherung.txt` → die Datei (privater Schlüssel) in beide
     Passwort-Manager + Papier in den Tresor, **nie auf den Server**
   - nur die Zeile `age1…` (öffentlicher Schlüssel, steht in der Datei und wird beim Erzeugen angezeigt) nach
     `/srv/make-os/sicherung.pub`: `ssh make@2.28.108.162 "echo 'age1…' > /srv/make-os/sicherung.pub"`
   - `/srv/make-os/.sicherung-passwort` **liegen lassen**: ältere `.enc`-Archive brauchen es, und es ist der Übergang,
     falls age einmal fehlt.
3. Dann Upload wie immer (push auf `main`). Nach der ersten Nacht im HOI: „Sicherung geprüft“ grün (nicht „Übergangs-Verschlüsselung“).

## Absichtsprotokoll, zufällige Kontakt-Kennungen, Dateiablage v2 (29.09.2026, Paket D-C, nur lokal — Commits 21a6cf5 · 7d40037 · 94d2b5a)

Kevin: Kontakt-Kennungen auf zufällige umstellen (Vorschau, Rückweg, alte Links leiten weiter). Alles mit Tests, nichts am Server.

- **Nichts bleibt halb:** Löschen (Art. 17), Dubletten zusammenführen, Import, „Angebot stellen“ und das Löschen eines Deals mit
  Leads schreiben mehrere Bestände nacheinander. Jetzt hält MAKE OS vorher fest, was es vorhat, und macht einen abgebrochenen
  Vorgang (Absturz, Deploy) beim Start, im Takt und nachts von selbst fertig. Klappt das dreimal nicht: Head of IT rot
  („Abgebrochene Vorgänge“, NOTFALL.md sagt, was zu tun ist).
- **Löschen (Art. 17) ehrlicher:** scheitert ein einzelner Speicher, laufen die anderen weiter; das Löschprotokoll steht dann auf
  „unvollständig“ (mit dem Namen des Schritts) und wird automatisch vervollständigt — die Oberfläche sagt es.
- **Neue Kontakte bekommen eine zufällige Kennung** (keine E-Mail mehr in Adressen, Protokollen, Import-Läufen). Der Import
  erkennt Personen weiter über E-Mail bzw. Name+Firma.
- **Kennungs-Umzug für den Bestand** (Stammdaten › Datenqualität › „Kontakt-Kennungen“, nur Kevin): Vorschau zeigt, wie viele
  und wo überall; „Umstellen …“ zieht alle Verweise mit (CRM, Ablage, Aufgaben, Heads, ZOE, Protokolle, Läufe, Suche), vorher
  Archivkopie. Alte Links (Notizen im Vault, Lesezeichen) leiten weiter. Rückweg möglich, solange keiner der Kontakte seitdem
  geändert wurde. **Läuft nie von selbst.** Getestet mit 500 erfundenen Kontakten (~0,6 s).
- **Dateien (Verträge, Angebote):** neue Dateien mit Schlüssel-Kennung und Bindung an Haushalt/Datei verschlüsselt; beim
  Schlüsselwechsel im Betrieb bleibt jede Datei lesbar. ZOE-Vorschläge und Dateien tragen Kennungen ohne Zeitstempel.

**Was Kevin am Server tun muss (erst auf dein Wort, in dieser Reihenfolge):**
1. **VOR dem Upload:** Grabstein-Ordner anlegen — ganz oben › „Go-Live: VOR dem Upload am Server“, Schritt 1.
2. Upload wie immer (push auf `main`).
3. **Nach dem Upload, wenn niemand im CRM arbeitet:** Stammdaten › Datenqualität › Kontakt-Kennungen → Vorschau ansehen →
   „Umstellen …“. Danach andere offene Fenster einmal neu laden. (DEPLOY.md › Kennungs-Umzug)

**Prüfliste (vor dem Hochladen, lokal mit Wegwerfdaten):**
- Kontakt anlegen (Kartei, Einlass) → Kennung `c-…` mit langer Zufallszeichenkette, keine E-Mail darin.
- Art. 17 an einem Testkontakt → Hinweis ohne Fehler, Löschprotokoll unter Stammdaten › Datenschutz mit Status.
- Karte „Kontakt-Kennungen“ → Vorschau zählt; Umstellen → alter Link `…?s=kontakte&a=akte&k=<alte Kennung>` öffnet die Akte.
- Head of IT: Befund „Abgebrochene Vorgänge: keine“.

## Aufgaben — Oberfläche, ZOE-Freigabe, Follow-up = Aufgabe, „Neu anfangen“ (29.09.2026, Paket T2, nur lokal — Commits 3ccaef9 · bd5bb36 · 5cbec77 · e138ef8 · 56ef653 · 8010907 · 9223eb5 · 369f171 · c5d94ad)

- **„Neu anfangen …“** (Aufgaben-Überblick und Ziele & Planung): Vorschau („n Ziele, n Meilensteine, n Projekte, n Aufgaben“,
  ruhende Serien, was bleibt), Bestätigung durch Tippen von „NEU ANFANGEN“. Alles wird **archiviert, nicht gelöscht** (vorher
  Sicherheitskopie), die Spaces sind danach leer, die Startvorlagen stehen bereit. Routinen, Vorlagen, CRM, Papierkorb und offene
  Fristen-Aufgaben (Steuern, Belege, Löschfristen, Events) bleiben. Unter Aufgaben › Archiv › „Neu angefangen“ ganz oder einzeln
  wiederherstellen (Serien laufen dann weiter).
- **Oberfläche für Kevins Entscheidungen:** 🔒 „nur ich“ (Detail + Schnell-Anlegen), Zuständig + Beteiligte (kein „Beide“ mehr),
  Filter Alle · Meine · Beteiligt, „Abgebrochen“ grau/durchgestrichen (eigene Board-Spalte), Serien: ab Fälligkeit/ab Erledigung,
  „im Wechsel: Kevin → Malin“, Werktage ohne Feiertage NRW, „Diese überspringen“ und „Serie beenden“ getrennt; Löschen einer
  laufenden Serien-Aufgabe fragt.
- **Weniger Fehlklicks:** Erledigen mit offenen Unteraufgaben fragt; Deadline verschieben fragt „Unteraufgaben mitverschieben?“;
  nach Löschen/Erledigen/Status/Verschieben 10 s „Rückgängig“; Datumsfelder speichern beim Verlassen; Schnell-Anlegen zeigt vor
  dem Speichern, was es erkannt hat („Fr 02.10. · kritisch · @Malin“), „so schnell wie möglich“ ist kein Sonntag mehr, „31.02.“ kein
  Datum. Suchfeld im Aufgabenraum; Suche überall mit Umlauten („mueller“ = „Müller“). Board/Liste per Tastatur und Screenreader
  bedienbar, „!!/!“ und „! 02.10.“ zusätzlich zur Farbe. Tote Links: „gibt es nicht mehr / im Papierkorb / archiviert“ (auch Glocke).
- **ZOE-Freigabe:** „alt → neu“ je Feld mit Häkchen; hat jemand Status/Deadline seit dem Vorschlag geändert, sagt ZOE es statt zu
  überschreiben; „Alle freigeben“ nur für risikoarme Vorschläge (Notiz/Unteraufgaben); „Charge rückgängig“ je ZOE-Lauf bzw.
  Sammelfreigabe; Deadlines nur echte Tage ab heute.
- **Follow-up = Aufgabe:** „Aufgabe anlegen“ am Kontakt legt eine Aufgabe an (auch in Aufgaben/Glocke); verknüpfte Follow-ups und
  Aufgaben werden gemeinsam erledigt; Follow-up › Fällig zeigt Aufgaben mit CRM-Bezug mit an.
- **Export** aller Aufgaben als JSON (Aufgaben › Archiv), Vorlagen mit Werktagen und Fassung, Umzug nach Privat fragt nach dem
  CRM-Bezug und nimmt die Dateien mit.

### Prüfliste (vor dem Hochladen durchklicken)
- [ ] Aufgaben › „Neu anfangen …“: Zahlen plausibel, „NEU ANFANGEN“ tippen → Spaces leer; Archiv › „Neu angefangen“ → ein
      Projekt zurückholen, dann „Alles wiederherstellen“ → alles wieder da (auch Ziele/Meilensteine unter Ziele & Planung).
- [ ] Aufgabe öffnen: „nur ich“ an/aus, Beteiligte wählen, Status „Abgebrochen“, Serie „Diese überspringen“ und „Serie beenden“.
- [ ] Hauptaufgabe mit offenen Unteraufgaben abhaken → Rückfrage; danach „Rückgängig“ im Hinweis unten.
- [ ] Schnell-Anlegen „Rechnung fr @malin“ → Vorschau „Fr … · @Malin“.
- [ ] ZOE-Vorschlag: Häkchen abwählen, Deadline vorher von Hand ändern → Hinweis „inzwischen geändert“; Aufgaben › ZOE → „Charge rückgängig“.
- [ ] Kontakt öffnen → „Aufgabe anlegen“ → erscheint in Aufgaben und Follow-up › Fällig; abhaken → verknüpftes Follow-up erledigt.

### Offen
- Brain (`lib/brain*`) liest `tasks` roh und kennt die Archiv-Marke von „Neu anfangen“ noch nicht — archivierte Aufgaben stehen im
  _App-Spiegel/Such-Index, bis das Brain-Paket `imArchiv` (lib/aufgaben/neustart.ts) berücksichtigt.
- Follow-up erledigt über die Aufgabe schreibt (noch) keine Aktivität an die Person.

## Datenschutz, Löschung, ZOE-Rechte (29.09.2026, Paket D-B, nur lokal — Commits d3b3551 · fe40d08 · 9ed9522 · c74ff91)

Kevin: „Top 1 %“ und „ZOE schreibt nur über den Stapel“. Alles mit Tests, nichts auf dem Server.

- **Eine gelöschte Person ist überall weg:** außer Kartei und CRM jetzt auch im alten Netzwerk, in Kunden/Stammdaten,
  in den Postfach- und Kalender-Zwischenspeichern, in Gesprächen/Gedächtnis/Protokoll/Stapel von ZOE, in ZOEs
  Entscheidungen und im Änderungsprotokoll (nur noch „[gelöscht]“), in Meldungen und in der Umzugs-Kopie im Archiv. Die
  Suche wird sofort nachgezogen. Ein Register aller Speicher mit Wächter-Test verhindert, dass ein neuer Speicher vergessen wird.
- **Auskunft (Art. 15)** zeigt zusätzlich ZOE-Protokoll, ZOE-Vorschläge, Änderungsprotokoll und je weiterem Speicher,
  wie oft die Person vorkommt. Das Löschprotokoll nennt nie mehr die Kennung (die E-Mail steckt darin) — nur eine Protokoll-ID.
- **Ein Restore holt Gelöschte nicht zurück:** „Grabsteine“ (nur Fingerabdrücke) liegen außerhalb des Datenordners und
  werden nach jedem Zurückspielen angewendet (Takt, Einzel-Restore, neues `deploy/wiederherstellen.sh`), gehen mit in die
  Nachtsicherung.
- **Gesalzene Fingerabdrücke:** Sperrliste und Protokoll-Kennungen mit geheimem Pepper (vorher erkannte man Gelöschte mit
  einer Mail-Liste wieder). Ohne Pepper läuft alles weiter wie bisher, der Head of IT zeigt gelb.
- **Eingeschränkte Personen (Art. 18)** verschwinden an einer Stelle aus allem, was verarbeitet (Ansprache, Power Hour,
  ZOE, Export); der Export nimmt sie nur mit dem Schalter „mit eingeschränkten Personen“ auf (für eine Auskunft).
- **Löschfristen neu:** ZOE-Protokoll und entschiedene Vorschläge 90 Tage, ZOE-Gespräche 12 Monate, Gedächtnis 24 Monate,
  Mail-Zwischenspeicher 30 Tage, Kalender 12 Monate, Umzugs-Kopien im Archiv 30 Tage, Grabsteine 13 Monate — alles unter
  Stammdaten › Datenschutz einstellbar; das alte Netzwerk zählt in die Löschfrist-Aufgabe.
- **ZOE schreibt nur über den Stapel:** Notiz am Kontakt, Deal anlegen, Übergabe, Kunde — und Aufgaben für die andere
  Person — liegen erst im Stapel, ein Klick übernimmt. Solche Einträge tragen „von ZOE, freigegeben von …“. Nach einer Mail
  im Gespräch startet ZOE keine Agenten mehr selbst; nach einem Blick ins CRM/Postfach geht keine Web-Recherche ohne Klick raus.
  ZOEs Protokoll hält nur noch Kennungen und Feldnamen, keine Gesprächsnotizen.
- **Brain:** Regeln wirken nur mit Freigabe einer bekannten Person; private Notizen sieht nur, wem sie gehören (auch Kevin
  nicht Malins); Vault-Konflikte und gescheiterte Pushes erscheinen im Head of IT rot („letzter erfolgreicher Push“).

**Was Kevin tun muss (erst auf dein Wort am Server):**
1. **Pepper erzeugen und setzen:** im Terminal `openssl rand -hex 32` → in `/srv/make-os/app/.env` als `MAKE_OS_PEPPER=…`
   (Vorlage `deploy/env.server.beispiel`), zusätzlich in beide Passwort-Manager + Papier. **Nie wechseln.** Lokal zum
   Ausprobieren in `.env.local` ebenso (eigener Wert).
2. **Grabstein-Ordner am Server:** VOR dem Upload — ganz oben › „Go-Live: VOR dem Upload am Server“, Schritt 1 (Volume und
   Variable stehen schon in `compose.yml`, nichts in die `.env`).
3. **Vault umziehen:** Schritt für Schritt nach `VAULT_UMZUG_ANLEITUNG.md` (vorher die offenen Änderungen festhalten,
   dann `~/Desktop/MAKE` → `~/Vaults/MAKE`, Obsidian neu öffnen, Abgleich-Dienst laden). Claude fasst den Vault nicht an.
4. Auftragsverarbeitungsvertrag mit dem KI-Anbieter ablegen (weiter offen).

## Aufgaben — Modell und Server (29.09.2026, Paket T1, nur lokal — Commits b0a301e + Schritt 2)

Kevins Entscheidungen vom 29.09. als Datenschicht; die Schalter in der Oberfläche baut Paket T2.

- **„Nur ich“:** eine Aufgabe kann nur für die Person sichtbar sein, die sie angelegt hat — überall (Überblick, Suche,
  Kalender, Glocke, ZOE, Brain, CRM-Akten, Heute/Flächen). Wer eine fremde „nur ich“-Aufgabe ändern will, findet sie nicht.
- **Eine Verantwortliche + Beteiligte** statt „Beide“: bestehende „Beide“-Aufgaben gehören der Person, die sie angelegt hat,
  die andere ist beteiligt (vorher Sicherheitskopie im Archiv). „Meine“ = verantwortlich; Beteiligte bekommen eine Meldung.
- **„Abgebrochen“** als Status: zählt nicht als erledigt, gibt Wartende nicht frei, erzeugt keine nächste Serien-Aufgabe.
- **Serien:** „ab Erledigung“, Wechsel Kevin/Malin, Werktage ohne Feiertage NRW, „nur diese löschen“ überspringt einen Termin
  (kommt nicht wieder), Serie beenden wirkt; wieder geöffnet → keine zweite offene Aufgabe mehr.
- **Sauberer gespeichert:** Datum wird geprüft (kein 31.02., Start nicht nach der Deadline), Zeitstempel setzt der Server,
  Heads/Steuern/Belege/Löschfristen/Events erledigen Aufgaben mit Verlauf und Serie, Kommentare werden nur weich entfernt.
- **Glocke ruhiger:** mehrere Zuweisungen auf einmal = eine Meldung; „wartet auf …“ statt „überfällig“, wenn eine Aufgabe
  noch auf eine andere wartet. Die Aufgabenliste lädt schneller (ETag/304).

## Datenschicht-Kern und Betrieb (29.09.2026, Paket D-A, nur lokal — Commits bea2739 · 1d4cd04 · 9081719 · e363279 · bec0500 · f1cff14)

Kevin: „Wir wollen Top 1 % sein.“ Die Datenschicht und der Betrieb gegen die Prüfliste der 100 typischen Fehler
(DATENARCHITEKTUR_FEHLER_PRUEFLISTE.md) nachgeschärft — alles mit Tests, nichts auf dem Server.

- **Nichts halb oder verloren:** jede Datei atomar und dauerhaft (auch Tagessicherung, Archiv, Skripte); eine gescheiterte
  Tagessicherung wird laut (HOI rot) und am nächsten Schreiben erneut versucht; kaputtes JSON wird nie überschrieben.
- **Sperren:** Hot-Reload-fest, Verklemmungen (Wiedereintritt, falsche Reihenfolge crm → kontakte) werfen sofort,
  30 s Zeitlimit mit Messwert. Lockfile `.data/.schreiber`: Skripte brechen ab, solange die App läuft. Docker wartet
  beim Beenden 60 s (laufende Vorgänge werden fertig).
- **Kennungen** `r-<uuid>` statt Millisekunden (keine doppelten Rechnungen mehr in derselben Millisekunde).
- **„Heute“** ist überall der Berliner Tag (auch ohne TZ, auch in Tests); ZOE-Verlauf „Heute/Gestern“ stimmt nachts.
- **Verschlüsselung v2:** Schlüssel-ID + AAD (vertauschte/zurückgespielte Dateien fallen auf), Klartext bei gesetztem
  Schlüssel wird abgelehnt, Schlüssel als Datei statt in der `.env`, **Rotation ohne Unterbrechung**
  (`deploy/datenschluessel-rotieren-live.sh`).
- **Sicherung:** nachts mit kurzer Schreibpause, geprüft (jeder Bestand entschlüsselt/gezählt), age (ohne age seit der
  Go-Live-Prüfung openssl-Übergang mit HOI rot), ohne
  `backup/` (wuchs quadratisch), Generationen 14 täglich / 8 wöchentlich / 12 monatlich, Status + Dead-Man-Ping immer.
- **Auf euren Mac:** der Mac holt jeden Morgen das neueste Archiv ab (nur lesend, Prüfsumme), HOI warnt ab 48 h.
- **Wiederherstellen:** Probe-Restore startet die App im Probe-Ordner und misst die Zeit; Einzel-Restore holt einzelne
  Datensätze aus einer Tageskopie (Vorschau, Stand-Prüfung, Protokoll). NOTFALL.md: eine Seite „Server weg → läuft wieder“.
- **Head of IT:** Sicherung geprüft, Dead-Man-Ping, Mac-Abholung, nächtliche Durchsicht aller Bestände (Zeilen-Sprünge,
  Verbindungsprüfung), Sperrwartezeit/Schreibdauer p50/p99, 409/413, Parse-Zeit, .tmp-Reste, Klartext, zweiter Schreiber.
- **Doppelt ausgeschlossen:** Beleg-Übernahme mit `anfrageId` (Retry legt nichts doppelt an), Aufträge mit Pacht-Token
  (ein zu langer Lauf wirkt nicht doppelt), Angebots-PDF außerhalb der CRM-Sperre (Nummer reserviert, keine Lücke).
- **Schema:** jeder Bestand trägt `_v`, Migrationsrahmen in `lib/store/schema.ts`; Wächter, dass die CRM-Säuberer jedes Feld kennen.

### Was Kevin auf dem Server tun muss (erst nach dem Hochladen, in dieser Reihenfolge)
1. **age-Empfänger:** VOR dem Upload — ganz oben › „Go-Live: VOR dem Upload am Server“, Schritt 2. (Fehlt er doch, sichert
   die Nacht nur mit der Übergangs-Verschlüsselung und der HOI zeigt rot.)
2. **Healthcheck (Pflicht):** Prüfung bei Healthchecks.io anlegen (1 Tag, Kulanz 2 h), Adresse nach `/srv/make-os/.healthchecks-sicherung`.
3. **Logrotate:** `sudo install -m 644 /srv/make-os/app/deploy/logrotate-make-os /etc/logrotate.d/make-os`.
4. **Schlüssel als Datei** (DEPLOY.md › Verschlüsselung): Datei `/srv/make-os/schluessel/daten` (0400), Zeile aus der `.env`
   nehmen, `docker compose up -d`. Danach ist die Rotation ohne Unterbrechung möglich.
5. **Einmal verschlüsseln** (alte v1-Hüllen/Klartext-Reste → v2): `docker compose stop app arbeiter` →
   `docker compose run --rm -T --no-deps app node scripts/daten-verschluesselung.mjs --verschluesseln </dev/null` → `docker compose up -d`.
   Ohne diesen Schritt werden v1-Hüllen beim nächsten Schreiben v2 — Klartext-Reste lehnt die App ab (HOI zeigt sie).
6. **Mac-Abholung** einrichten (unten), dann im HOI prüfen: „Sicherung am Mac“ grün.

### Was Kevin am Mac tun muss
1. `deploy/sicherung-abholen.sh --einrichten` → die angezeigte Zeile in `/home/make/.ssh/authorized_keys` auf dem Server.
2. `cp deploy/de.makeos.sicherung.plist ~/Library/LaunchAgents/ && launchctl load ~/Library/LaunchAgents/de.makeos.sicherung.plist`,
   einmal von Hand `deploy/sicherung-abholen.sh` → Archiv liegt in `~/MAKE-OS-Sicherungen`.
3. **Probe-Restore** (NOTFALL.md › Übung): `deploy/sicherung-probe.sh ~/MAKE-OS-Sicherungen/<archiv> <age-identität> --app`,
   Ergebnis in DEPLOY.md eintragen.
4. **NOTFALL.md** durchgehen: Datenschlüssel, alter Schlüssel (26.09.), age-Identität, Sicherungspasswort in beide
   Passwort-Manager + Papier in den Tresor.

### Prüfliste (vor dem Hochladen)
- [ ] Lokal `./start.sh` → baut ohne Fehler (instrumentation), `/os/hoi` zeigt die neuen Befunde (Durchsicht grau bis 4 Uhr).
- [ ] Beleg in ZOE lesen, „Als Rechnung“ zweimal schnell klicken → eine Rechnung.
- [ ] Angebot stellen → PDF in der Ablage, Nummer lückenlos.
- [ ] `node scripts/daten-verschluesselung.mjs --verschluesseln` bei laufender App → bricht mit Meldung ab.

### Offen (nächste Pakete)
- Dateiablage (`lib/dateien/ablage.ts`): liest `.bin` nur mit dem aktiven Schlüssel → auf `schluesselRing()` umstellen
  (während einer Rotation sonst Sekunden ohne Zugriff auf ältere Dateien); `.bin` ohne AAD/Schlüssel-ID; `neueDateiId` noch mit Zeit.
- Kennungen in `lib/zoe/stapel.ts`, `lib/zoe/protokoll.ts`, `components/os/aufgaben/hilfe.ts` (andere Pakete) und Kontakt-Kennungen `c-…`.
- Grabsteine für Wiederherstellungen (#70), Absichtsprotokoll für Mehr-Bestand-Vorgänge (#17), SQLite-Auslöser beobachten.

## Aufgaben & CRM: nichts geht beim Speichern verloren (29.09.2026, A1–A9, nur lokal — Commit d5a1502)

Kevin: „Alle Infos müssen immer sauber gespeichert werden — extrem wichtig.“ Reparatur der Prüfbefunde, mit Tests.

- **Nicht gespeichert = sichtbar und nicht weg:** Aufgaben-Änderungen bleiben ausstehend, bis der Server sie bestätigt. Netz weg, Neustart beim Hochladen (502), Sitzung abgelaufen → unten rechts „Nicht gespeichert — wird erneut versucht (in 8 s)“ + „Jetzt“; der Abgleich alle 45 s überschreibt nichts mehr (eigene Änderungen kommen wieder obendrauf). Zu groß/ungültig → die Zeile bleibt mit Grund stehen („Erneut versuchen“/„Verwerfen“), der Rest wird gespeichert.
- **Konflikt zu zweit:** nur die betroffene Aufgabe zeigt den Stand der anderen Person, die eigene bleibt als „Deine Fassung“ („übernehmen“/„kopieren“) — überall (Aufgaben, CRM-Kachel, Flächen, Heute). Angebots-Editor genauso, dazu erneuter Versuch per Timer.
- **Tab zu / Seite weg:** sofort speichern (keepalive) und Browser-Warnung, solange etwas offen ist; offene Aufgaben-Änderungen überleben Neuladen im selben Tab.
- **Alte Tabs nach dem Hochladen:** jeder Bau hat eine Kennung; ein alter Tab bekommt beim Speichern „MAKE OS wurde aktualisiert — bitte neu laden“ statt mit altem Code Einträge zu ersetzen (Aufgaben, Kartei, CRM, Angebote, Gesellschaften, Dateien). Nach „Neu laden“ gehen die gemerkten Aufgaben-Änderungen erneut raus (mit Konfliktprüfung).
- **Notizen + Projektbeschreibung** speichern von selbst (Pause, Feld verlassen, Seite verlassen); Entwurf im Tab gemerkt, bis der Server bestätigt; zu lang → rote Meldung, nichts gekürzt. Projekttitel über 120 Zeichen → Meldung statt still gekürzt.
- **Papierkorb** (Aufgaben › Archiv › Papierkorb): Projekt löschen nimmt Aufgaben, Notiz, Felder, Listen, Dateien mit in den Papierkorb; Aufgabe samt Unteraufgaben. 30 Tage „Wiederherstellen“, danach räumt der Morgenlauf auf; „Endgültig löschen“ getrennt (dann auch die Dateien). Die Rückfrage nennt, was mitgeht.
- **Eigene Felder:** Auswahl-Wert umbenennen → alle Aufgaben ziehen mit; entfernte Werte bleiben an den Aufgaben stehen; „1.500“ im Betragsfeld = 1.500 € (vorher 1,50 €).
- **Übernahme beim ersten Online-Lauf:** vor dem ersten Schreiben liegt einmal eine Kopie `archiv/tasks-vor-umbau-<zeit>.json` (verschlüsselt).
- **Fokus-Zähler** läuft jetzt auch nach Gerätewechsel weiter (Start liegt auf dem Server); Beenden löscht ihn erst, wenn die Zeit gespeichert ist.
- Eingang aus dem iCloud-Ordner: nur im Haushalt, über den normalen Schreibweg (Listen/Status/Gruppen/Vorlagen bleiben), abgehakt erst nach dem Speichern. Dateiablage schreibt mit fsync; Schlüssel-Rotation prüft auch Archiv und Dateien auf Klartext.
- Tests: `tests/aufgaben-speichern-sicher.test.ts`, `aufgaben-abgleich`, `aufgaben-papierkorb`, `aufgaben-felder-werte`, `bau-kennung`, `fokus-laufend`.

### Offene Punkte
- `lib/brain*` liest den Aufgaben-Bestand noch roh (Papierkorb dort ausblenden — Paket Brain).
- Nach dem Ausrollen: offene alte Tabs zeigen einmal „bitte neu laden“ — das ist gewollt.

### Prüfliste (vor dem Hochladen durchklicken)
- [ ] Aufgabe ändern, WLAN aus → unten rechts „Nicht gespeichert — wird erneut versucht“; WLAN an → Hinweis verschwindet, Änderung ist da (zweites Gerät neu laden).
- [ ] Zwei Fenster, dieselbe Aufgabe unterschiedlich ändern → im zweiten „wurde inzwischen geändert“ + „Deine Fassung übernehmen“ → danach steht deine Fassung.
- [ ] Notiz tippen, sofort Tab schließen → Browser warnt; nach erneutem Öffnen ist der Text gespeichert.
- [ ] Notiz über 50.000 Zeichen einfügen → rote Meldung „NICHT gespeichert“, Text bleibt.
- [ ] Projekt löschen → Rückfrage nennt Aufgaben/Notiz/Dateien → Aufgaben › Archiv › Papierkorb → Wiederherstellen → Projekt samt Aufgaben, Notiz, Feldern wieder da.
- [ ] Papierkorb → „Endgültig löschen“ → Dateien des Projekts sind weg.
- [ ] Eigenes Auswahl-Feld „Web“ → „Online“ umbenennen → Aufgaben zeigen „Online“.
- [ ] Nach dem Neustart des Dev-Servers in einem alten Tab eine Aufgabe ändern → Banner „MAKE OS wurde aktualisiert — bitte neu laden“ → Neu laden → Änderung ist gespeichert.
- [ ] Fokus am Mac starten, am Handy öffnen → Zähler läuft dort mit.

## Brain: alles sauber gespeichert — Freigaben dauerhaft, App → Brain, eine Suche (29.09.2026, S2, nur lokal)

Kevin: „Alle Infos müssen immer sauber gespeichert werden — online in unserem Brain. Extrem wichtig.“ Dazu Kevins Entscheidung 29.09. (BRAIN_SERVER_PLAN.md): Server-Vault = Wahrheit.

- **Freigaben dauerhaft:** Jede Entscheidung im Stapel (freigegeben · abgelehnt · fehlgeschlagen · zurück an ZOE) steht jetzt mit **wer**, Art, Bezug und Grund dauerhaft in einer Monatsdatei (`zoe-entscheidungen`), dazu jede ZOE-Ausführung (nur Feldnamen). Die Arbeitslisten dürfen erst danach kürzen — nichts verschwindet mehr still. Im Stapel steht bei Entschiedenem, wer es war.
- **Nichts doppelt:** Doppelklick, zwei Fenster oder „Alle freigeben“ gleichzeitig legen eine Aktivität/ein Follow-up/einen Beitrag nur einmal an („Wird gerade übernommen“ für den zweiten). Zu langer Ablehnungsgrund (> 400 Zeichen) wird abgelehnt statt abgeschnitten.
- **App → Brain:** Nachts liegt in der Brain-Inbox je Tag ein **„App-Tagesbericht“** (erledigte Aufgaben je Projekt, Projekt-Notizen, Angebote, Deal-Stufen, Mandate, ZOE-Entscheidungen, Zeit je Mandat) — annehmen oder ablehnen wie jeden Vorschlag. Privates standardmäßig nur als Zahl, eingeschränkte Kontakte (Art. 18) und „nur ich“ nie.
- **`_App/`-Spiegel im Server-Vault** (Projekte, Mandate, Angebote, Entscheidungen, Wochenrückblick) — gebaut, **aus**, bis Kevin ihn einschaltet (`MAKE_OS_APP_SPIEGEL=an`).
- **Eine Suche für ZOE:** „Wo hatten wir … notiert?“ sucht jetzt in Brain-Notizen UND Aufgaben, Kommentaren, Projekten, Angeboten, Mandaten (`suche_arbeit`, mit Links).
- ZOE-Kontext zählt nur Hauptaufgaben (ohne Papierkorb); „Mandate“ bei ZOE zeigt die Zeit je Mandat der Woche.
- Tests: `tests/zoe-entscheidungen.test.ts`, `tests/brain-app-bruecke.test.ts`.

### Offene Einmal-Schritte (Server, erst auf Kevins Wort)
- [ ] `MAKE_OS_APP_SPIEGEL=an` in `/srv/make-os/app/.env` setzen (Plan Schritt 3) und einmal `POST /api/brain/app { "aktion": "jetzt" }` bzw. den nächtlichen Lauf abwarten.
- [ ] Privat-Einstellung festlegen: Standard „nur Zahlen“; voll nur mit `POST /api/brain/app { "privat": "voll" }`.

### Prüfliste (vor dem Hochladen durchklicken)
- [ ] Stapel: einen Vorschlag ablehnen mit Grund → unter „Entschieden“ steht die Person; Grund mit 500 Zeichen → Hinweis „länger als 400 Zeichen“, nichts entschieden.
- [ ] CRM-Vorschlag (Aktivität) in zwei Fenstern gleichzeitig freigeben → eine Aktivität am Kontakt, das zweite Fenster meldet „Wird gerade übernommen“ bzw. „Schon entschieden“.
- [ ] ZOE fragen: „Wo hatten wir etwas zu <Stichwort aus einer Aufgaben-Notiz> notiert?“ → Treffer mit Link in die Aufgabe (und ggf. Brain-Notiz).
- [ ] ZOE fragen: „Wie viel Zeit ging diese Woche in welches Mandat?“ → Stunden je Mandat.
- [ ] Wissen › Brain-Inbox am nächsten Morgen: „App-Tagesbericht <gestern>“ vorhanden, ohne private Titel, annehmen → Protokoll unter „03. Protokolle/App“.

## ZOE sieht und unterstützt die ganze Markttraktion (28.09.2026 spät, C7, nur lokal)

- **Kevins Entscheidung:** ZOE liest jetzt CRM und CRM-Dateiablage (hebt „Ablage nie an ZOE“ auf) — nur im Gespräch mit Kevin oder Malin, mit festen Leitplanken: Art.-18-eingeschränkte Kontakte gar nicht (nur „n ausgeblendet“), private Notizen nur die eigenen, IBAN maskiert, fremder Text gekapselt, lange Antworten in Teilen.
- **Lesen (15 Werkzeuge):** Suche über alles mit Filtern, Kontakt- und Firmenakte, Pipeline/Deal-Akte, Mandate, Angebote, Kampagnen, Events (Make.One), Marketing, Kennzahlen (Traktions-Index), Sales (Power Hour), Qualifizierung (Runden), Stammdaten, Datenqualität, CRM-Dateien lesen. `suche_kontakt`/`crm_lage` laufen weiter, jetzt über dieselbe Sicht.
- **Unterstützen:** ZOE legt nur Vorschläge in den Stapel (Art „crm“) — Aktivität, Follow-up, Deal, Kontaktfelder, Qualifizierung, Dubletten, Reparatur, Import-Konflikt, Angebots-Entwurf (nie stellen), Nachricht/Leitfaden/Einladung/Danke zum Kopieren, Power-Hour-Reihenfolge, Beitrag, Newsletter, Segment, Gästeliste, Leistungstext, Head-Vorschlag annehmen/ablehnen (Heads lesen: `heads_lage`). Erst der Klick übernimmt, über die normalen Wege (409 bei zwischenzeitlicher Änderung, Art.-18- und Werbesperre greifen). Versendet wird nichts.
- **Oberfläche:** „ZOE fragen“ oben rechts in der Markttraktion (nimmt mit, was offen ist: Kontakt, Firma, Deal, Angebot — sonst den Reiter) und in der Firmenakte; ZOE zeigt oben „Bezug …“. Karte „ZOE-Vorschläge“ in Kontakt öffnen (rechts) und in der Firmenakte: Freigeben / Ablehnen mit Grund, bei Nachrichten „Kopieren“ und „Im Mail-Programm öffnen“.
- **Organisatorisch:** AVV mit dem KI-Anbieter ablegen (CRM_FEHLER_ABGLEICH #101).
- Tests: `tests/zoe-crm.test.ts` (Modell gemockt).

### Prüfliste (vor dem Hochladen durchklicken)
- [ ] Kontakt öffnen → „ZOE fragen“ → ZOE zeigt „Bezug · Kontakt c-…“; Frage „Was steht bei dieser Person an?“ → Antwort aus der Akte (private Notiz der anderen Person taucht nie auf).
- [ ] Kontakt mit Einschränkung (Art. 18): ZOE findet ihn nicht, sagt höchstens „1 eingeschränkter Kontakt ausgeblendet“.
- [ ] „Schlag vor, ein Follow-up für nächsten Dienstag anzulegen“ → Karte „ZOE-Vorschläge“ an der Person → Freigeben → Follow-up steht, im Änderungsprotokoll als ZOE im Auftrag.
- [ ] Vorschlag stehen lassen, den Kontakt selbst ändern, dann freigeben → Hinweis „inzwischen geändert“, Vorschlag bleibt offen.
- [ ] Angebots-Entwurf vorschlagen lassen → Freigeben → Angebot steht als Entwurf (ohne Nummer) im Angebots-Tool; stellen nur dort.
- [ ] Nachricht an jemanden mit Werbesperre bzw. ohne Grundlage → ZOE lehnt ab (Kanal-Ampel), kein Vorschlag.
- [ ] Firmenakte: „ZOE fragen“, IBAN nur maskiert in der Antwort; Vorschläge an Personen der Firma erscheinen auch dort.
- [ ] Reiter Sales/Marketing/Make.One/Qualifizierung/Stammdaten → „ZOE fragen“ nimmt den Reiter als Bezug.
- [ ] „Was schlägt der Head of Sales vor?“ → ZOE listet offene Vorschläge; „nimm den ersten an“ → liegt im Stapel, Freigeben → im Head-Fenster „angenommen“.
- [ ] Aufträge & Freigaben: CRM-Vorschlag zeigt Text, „Kopieren“, „In der Markttraktion öffnen ›“.

## Aufgaben: ZOE bereitet vor, ihr gebt frei (28.09.2026 spät, C4, nur lokal)

- **An ZOE geben:** in jeder Aufgabe/Unteraufgabe unten „ZOE“ → „An ZOE geben“ (optional „+ Hinweis“). Zuständig bleibt, wie es war; wer gibt, ist die Auftraggeberin und gibt später frei.
- **ZOE arbeitet:** Knopf „ZOE jetzt arbeiten lassen“ (an der Aufgabe oder in Aufgaben › Ansicht „ZOE“, höchstens 5 je Lauf) — und einmal morgens nach dem Morgenlauf von selbst, wenn etwas bei ihr liegt. Sie liest Aufgabe, Notiz, Unteraufgaben, Projekt-Notiz, Dateien der Aufgabe und eine CRM-Kurzinfo (ohne private Notizen, gesperrte Kontakte gar nicht) und legt **nur einen Vorschlag** ab: Entwurf/Recherche-Notiz, Unteraufgaben, ggf. Status/Deadline. Die Aufgabe selbst bleibt unverändert; Glocke „ZOE hat „…“ vorbereitet“.
- **Freigeben / Ablehnen:** direkt an der Aufgabe (Vorschlag lesen → Freigeben · Ablehnen mit Grund · „Nochmal mit Hinweis …“) oder im Stapel unter Aufträge & Freigaben (auch „Alle freigeben“). Freigeben hängt den Entwurf an die Notiz, legt Unteraufgaben an, setzt Status/Deadline — im Verlauf „ZOE: wartet auf Freigabe → freigegeben“ mit deinem Namen.
- ZOE schickt nichts nach außen und löscht nichts. Im Gespräch: „Was liegt bei dir?“ (`meine_aufgaben`), „Gib … an dich“ (`aufgabe_an_zoe`).
- Tests: `tests/zoe-aufgaben.test.ts` (Modell gemockt).

### Prüfliste (vor dem Hochladen durchklicken)
- [ ] Aufgabe öffnen → „An ZOE geben“ mit Hinweis → Chip „bei ZOE“, Kommentar „Hinweis an ZOE: …“, Verlauf-Eintrag.
- [ ] „ZOE jetzt arbeiten lassen“ → nach kurzer Zeit „wartet auf Freigabe“; Glocke zeigt „ZOE hat … vorbereitet“; Titel/Notiz/Status der Aufgabe unverändert.
- [ ] Vorschlag an der Aufgabe lesen → Freigeben → Notiz trägt den Entwurf, Unteraufgaben stehen da, Status/Deadline gesetzt.
- [ ] Andere Person (Malin) öffnet dieselbe Aufgabe → sieht nur „wartet auf die Freigabe von Kevin“, keine Knöpfe.
- [ ] Ablehnen mit Grund → Chip „abgelehnt“; „Nochmal an ZOE geben“ → neuer Vorschlag berücksichtigt Grund/Hinweis.
- [ ] Aufträge & Freigaben: Aufgaben-Vorschlag mit Entwurf und „Aufgabe öffnen ›“; Freigeben/Ablehnen dort wirkt an der Aufgabe.
- [ ] Ohne Modell-Schlüssel: Knopf gesperrt/Hinweis, nichts verändert.

## Aufgaben: wiederkehrend und Vorlagen (28.09.2026 spät, C3, nur lokal)

- **Wiederkehrende Aufgabe:** im Detail „Wiederholt: nie · täglich · Werktage · wöchentlich (Tage) · monatlich (Tag) · jährlich“, „alle n …“, „bis …“, Vorschau „nächste: Mo 05.10.“. Beim Abhaken entsteht sofort die nächste Aufgabe mit neuer Deadline (Unteraufgaben wieder offen, Notiz/Felder/Zuständig/CRM-Bezug übernommen, Kommentare und Verlauf nicht). Nie mehr als eine offene je Serie; wer lange weg war, bekommt keinen Stapel überfälliger Kopien — die nächste Deadline springt auf heute oder später. Monatstag 31 = immer Monatsende (30./28./29.). ↻ an der Zeile.
- **Wiederkehrende Liste:** ↻ am Listenkopf → z. B. monatlich am 1., Titel-Muster „Monatsabschluss {Monat} {Jahr}“, Aufgaben aus dieser Liste oder aus einer Vorlage. Der Morgenlauf (Tagesstart) legt zum Termin die neue Liste mit ihren Aufgaben an (Deadlines ab Listenstart). Verpasste Monate holt er einzeln nach (einer je Tag), bei täglich/wöchentlich nur den aktuellen — mit Hinweis im Tagesstart.
- **Vorlagen:** „Vorlagen“ oben im Space → „Aus Vorlage anlegen …“ (Space/Projekt, Startdatum, Name) bzw. mit gewähltem Projekt „Projekt als Vorlage speichern …“; Listen über ↻ → „Nur als Vorlage speichern …“. Gespeichert wird nur die Struktur (Gruppen, Listen, Aufgaben, Unteraufgaben, eigene Felder, Notiz) — ohne CRM-Verknüpfungen, Kommentare, Dateien. Drei Startvorlagen: Monatsabschluss Buchhaltung · Mandats-Onboarding · Launch-Projekt (Marketing · Sales · Operations).
- Tests: `tests/aufgaben-serie.test.ts` (Monatsende, Schaltjahr, Zeitumstellung, Instanz idempotent, Lawinen-Grenze, Vorlagen).

### Prüfliste (vor dem Hochladen durchklicken)
- [ ] Aufgabe mit Deadline heute → „Wiederholt: täglich“ → abhaken → neue Aufgabe für morgen steht da (nach kurzem Nachladen), ↻ an beiden.
- [ ] Neue Aufgabe wieder öffnen und erneut abhaken → keine dritte.
- [ ] Monatlich am 31. mit Deadline 30.09. → Vorschau „nächste: Sa 31.10.“; im November → 30.11.
- [ ] Unteraufgaben erledigt → nach dem Abhaken der Hauptaufgabe sind sie in der neuen Aufgabe wieder offen, Deadlines mitverschoben.
- [ ] Liste „Monatsabschluss September 2026“ → ↻ → monatlich am 1., Muster „Monatsabschluss {Monat} {Jahr}“ → „nächste Liste am Do 01.10.“; am 01.10. Tagesstart → neue Liste „Monatsabschluss Oktober 2026“ mit den Aufgaben; zweiter Tagesstart (neu starten) → keine zweite Liste.
- [ ] „Vorlagen“ → „Aus Vorlage anlegen …“ → Launch-Projekt im Space UG, Start heute → Gruppen Marketing/Sales/Operations mit Listen und Deadlines.
- [ ] Mandats-Onboarding in einem Mandanten-Space → Aufgaben tragen die Firma (Link in die Akte).
- [ ] Projekt als Vorlage speichern → in „Aus Vorlage anlegen“ unter Projekt-Vorlagen; Löschen der Vorlage lässt angelegte Projekte stehen.

## Aufgaben: Tabelle und Kalender (28.09.2026 spät, C5, nur lokal)

- **Tabelle:** alle Aufgaben des Space bzw. Projekts (mit den Filtern oben) als Zeilen, Unteraufgaben per Pfeil aufklappbar. Spalten: Aufgabe, Status, Zuständig, Deadline, Priorität, Liste/Gruppe, CRM-Bezug (Link in die Akte), „Wartet auf“ und die eigenen Felder des Projekts (Betrag in Euro, Zahl, Datum, Auswahl, Person, Link, Text).
- **Direkt ändern:** Status, Zuständig, Deadline, Priorität und Felder in der Zelle — gespeichert wird wie überall als Einzeländerung; hat jemand anders die Aufgabe inzwischen geändert, kommt der bekannte Hinweis.
- **Sortieren und Spalten:** Klick auf den Spaltenkopf sortiert (aufsteigend → absteigend → wie die Liste), leere Werte stehen immer unten. „Spalten“ blendet ein/aus; Spalten und Sortierung merkt sich jedes Gerät je Person.
- **Summen:** unten die Summe je Zahl-/Betrag-Feld (auch aus Unteraufgaben, z. B. einzelne Belege).
- **Kalender:** Monat (Standard) und Woche; Aufgaben an ihrer Deadline, mit Start als Balken von Start bis Deadline. Farbe nach Status oder Gruppe, überfällig mit rotem „!“, wiederkehrende mit ↻. Klick öffnet das Detail.
- **Verschieben:** Aufgabe auf einen anderen Tag ziehen — oder Aufgabe öffnen und „verschieben auf …“ (Datum, Heute, Morgen, ± 1 Tag, + 1 Woche). Mit Start wandert der Start mit. „Ohne Datum“ steht als Liste daneben und lässt sich auf einen Tag ziehen.
- **Handy:** Tabelle wischt im eigenen Kasten quer, die Aufgaben-Spalte bleibt stehen; die Seite läuft nicht quer.
- Umschalter Liste · Board · Tabelle · Kalender kommt mit dem Umbau der Aufgaben-Seite (C1). Tests: `tests/aufgaben-ansichten.test.ts`.

### Prüfliste (vor dem Hochladen durchklicken)
- [ ] Space mit Projekt mit eigenen Feldern → Tabelle: Felder als Spalten, Betrag „1.234,56 €“, Summe unten stimmt.
- [ ] Kopfklick Deadline: auf/ab, Aufgaben ohne Deadline bleiben unten; dritter Klick = Liste.
- [ ] Status/Zuständig/Priorität/Deadline in der Zelle ändern → Liste und Detail zeigen es, nach Neuladen noch da.
- [ ] Spalte „CRM-Bezug“ ausblenden → nach Neuladen weiter aus (nur bei mir, Malin sieht ihre Einstellung).
- [ ] Handy: Tabelle wischt quer, Seite nicht; Aufgaben-Spalte bleibt links stehen.
- [ ] Kalender: Aufgabe mit Start 21.09. und Deadline 25.09. → Balken über fünf Tage; über den Wochenwechsel läuft er in der nächsten Zeile weiter.
- [ ] Aufgabe auf einen anderen Tag ziehen → Deadline (und Start) verschoben; am Handy „verschieben auf …“.
- [ ] „Ohne Datum“ → auf einen Tag ziehen setzt die Deadline.
- [ ] Mehr als drei Aufgaben an einem Tag → „+n“ öffnet die Woche mit allen.
## Aufgaben tiefer: Gruppen, Projektseite, Notizen, Felder, „wartet auf“, Verlauf, Navigation wie im CRM (28.09.2026 spät, C1, nur lokal)
- **Datenmodell** (cb67a98): Gruppen je Projekt (Liste in Gruppe oder direkt im Projekt), Projekt mit Notiz/Beschreibung/Status/Zeitraum/
  Mitgliedern/eigenen Feldern, Aufgabe mit Notiz/Feldwerten/„wartet auf“/Wiederholung/ZOE-Stand/Verlauf, Vorlagen im Bestand. Altbestand wird
  beim Lesen übernommen (idempotent, nichts geht verloren; alte `dependencies` werden zu „wartet auf“).
- **Navigation:** /os/aufgaben startet mit dem Überblick (Kacheln meine · heute · überfällig · wartet auf Freigabe, Karten je Privat/Firma/Mandant),
  Leiste Überblick · Privat · Firmen ▾ · Mandanten ▾ · Archiv, im Space Brotkrumen Space ▾ › Projekt ▾ › Gruppe ▾ › Liste ▾. Alles in der Adresse,
  alte Links (Glocke, Suche, Kalender) funktionieren weiter.
- **Projektseite:** Kopf (Status, Zeitraum, Mitglieder, Beschreibung, Fortschritt, Verantwortliche), Reiter Aufgaben · Notizen · Dateien · Felder · Verlauf.
- **Aufgabe:** Unteraufgaben mit eigenem Status/Zuständig/Deadline, umwandeln/herauslösen, eigene Felder, „wartet auf …“ (Kreise werden abgelehnt,
  blockierte Aufgaben sind markiert), Notiz mit Checklisten, Fokus-Zeit, Dateien, Verlauf.
- Mandanten-Space: Kopf mit Firma → Firmenakte, Mandat → Mandat, Zuständig; die Aufgaben-Kachel in Firmenakte/Kontakt führt in den Mandanten-Space.

### Prüfliste (vor dem Hochladen durchklicken)
1. /os/aufgaben → Überblick mit vier Kacheln; „Überfällig“ antippen → Liste; Karte „KD Ventures“ → Space öffnet sich.
2. „+ Projekt“ → „Launch“ → Projektseite; unten „+ Gruppe“ Marketing, Sales; in Marketing „+ Liste“ Woche 1; Aufgabe anlegen, aufklappen,
   Unteraufgaben mit Enter nacheinander anlegen.
3. Brotkrumen: Projekt ▾ auf ein anderes Projekt, Liste ▾ auf eine andere Liste — Zurück-Knopf führt zurück.
4. Reiter Felder: „Budget“ (Betrag) anlegen; in einer Aufgabe 1.500,40 eintragen → bleibt 1.500,40 €.
5. Aufgabe B „wartet auf“ A → B zeigt „wartet“; A „wartet auf“ B versuchen → steht nicht zur Wahl.
6. Notiz mit `- [ ] Punkt` → in der Vorschau abhaken.
7. Verlauf der Aufgabe zeigt Status-/Deadline-Wechsel mit Person und Zeit.
8. Alter Link /os/aufgaben?offen=<id> (aus der Glocke) öffnet die Aufgabe in ihrem Space.

## Dateien an Projekten und Aufgaben (28.09.2026 spät, C2, nur lokal)

- **Hochladen an Projekt und Aufgabe:** Ziehen & Ablegen oder „Auswählen“ (mehrere auf einmal) — PDF, Bilder (PNG, JPG, WEBP, HEIC), Word, Excel, PowerPoint, CSV, TXT, Markdown bis 25 MB. Liste mit Typ, Größe, wer/wann; Vorschau für Bilder und PDF (PDF im neuen Tab), Herunterladen, Umbenennen + Beschreibung, Löschen mit Rückfrage.
- **Sicher:** verschlüsselt wie die CRM-Ablage, Typ am Inhalt geprüft (umbenannte Programme/HTML werden abgewiesen), nur der Haushalt des Inhabers. Privat und Business getrennt (der Bereich kommt aus dem Space); private Dateien erscheinen nie im CRM.
- **Verlauf:** an einer Aufgabe steht „Datei hinzugefügt/entfernt“; das Änderungsprotokoll nennt nur Kennungen.
- **ZOE liest mit (Kevins Wahl):** „Was liegt im Projekt Buchhaltung?“ → `projekt_unterlagen`; „Lies mir das Protokoll vor“ → `datei_lesen` (Text aus PDF/Word/Excel/PowerPoint/CSV/TXT/MD, bei Bildern nur die Angaben). Immer als fremder Text gekapselt, höchstens 30.000 Zeichen je Aufruf (längere Dateien in Teilen), nie im Hintergrund. Angebote, Rechnungen, Einwilligungsbelege und Mandatsunterlagen der CRM-Ablage liest ZOE weiterhin nicht.
- **Datenqualität:** meldet Dateien, deren Projekt/Aufgabe gelöscht wurde, und fehlende Inhalte.
- Nebenbei behoben: Löschen in der CRM-Ablage entfernte eine Datei auf der Platte auch dann, wenn sie gar nicht zur CRM-Ablage gehörte.
- Tests: `tests/aufgaben-dateien.test.ts`, erweitert `tests/crm-verbindungen.test.ts`.

### Prüfliste (vor dem Hochladen durchklicken)
- [ ] Projektseite/Aufgabe (sobald C1 `ProjektDateien` einhängt): PDF, Foto und Excel hineinziehen → stehen in der Liste; Foto-Vorschau, PDF öffnet im neuen Tab.
- [ ] Umbenennen: Endung bleibt; Beschreibung erscheint unter dem Namen.
- [ ] Datei an einer Aufgabe löschen → Rückfrage, danach weg; Verlauf der Aufgabe zeigt beides; direkt danach Status ändern klappt ohne „inzwischen geändert“.
- [ ] Eine `.exe`, in `.pdf` umbenannt → abgelehnt; 30-MB-Datei → „zu groß“.
- [ ] ZOE: „Welche Unterlagen hat das Projekt …?“ und „Lies die Datei …“ → Inhalt kommt, bei langen Dateien Hinweis auf Teil 2.
- [ ] CRM › Kontakt › Umsatz: keine Projekt-Dateien in der Liste.
- [ ] Stammdaten › Datenqualität: keine „Datei ohne Eintrag“ für Projekt-Dateien.

## Mandanten überall klickbar (28.09.2026 spät, C6, nur lokal)

- **Ein Klick auf den Mandanten führt in die CRM-Akte** — das Mandat, wenn es eins gibt, sonst die Firmenakte. Gleiche Optik wie im CRM (Name in Textfarbe, davor Punkt bzw. 🏢).
- **Wo:** Fokus › Zeit je Mandat · Mandat-Chip an Zielen, Meilensteinen und Fokus-Blöcken (kleines „›“ daneben) · Finanzplanung › Rechnungen (Kunde; ohne Mandat nur, wenn der Name eindeutig zu einem Mandanten passt) · Liquidität › Posten aus einem Mandat (aufgeklappt „Mandat“) · Kalender-Fristen (Ende, Kündigungsfrist, Review) öffnen direkt das Mandat statt der Liste · Schnellsuche (Mandat mit dem aktuellen Firmennamen, Firmen mit aktivem Mandat als „Mandant“ markiert) · im Mandat selbst „Firma“ zurück in die Firmenakte.
- **Gelöscht:** ist das Mandat weg, führt der Link zur Firma; ist beides weg, steht „(gelöscht)“ als Text. **Privat** zeigt nie einen Mandanten; wer keinen CRM-Zugang hat, sieht nur den Namen.
- Business-Cockpit, Modell, Mandatsliste, Firmenakte und Deal-Akte waren schon klickbar — unverändert.
- Tests: `tests/mandant-link.test.ts`.

### Prüfliste (vor dem Hochladen durchklicken)
- [ ] Fokus › Zeit je Mandat: Name anklicken → Mandat öffnet sich (Produkte & Mandate, aufgeklappt).
- [ ] Ziel mit Mandat: „›“ neben dem Chip → Mandat; beim Anlegen kein „›“.
- [ ] Finanzplanung: Rechnung mit Mandat → Kunde ist Link; Rechnung mit unbekanntem Kunden bleibt Text.
- [ ] Liquidität: Posten „Mandate & Honorare“ aufklappen → „Mandat“ mit Link.
- [ ] Kalender: Mandatsfrist anklicken → genau dieses Mandat.
- [ ] ⌘K: Mandant suchen → Firma „Mandant“, Mandat mit Firmennamen.
- [ ] Mandat aufklappen → „Firma“ führt in die Firmenakte.
- [ ] Konto außerhalb des Haushalts (ohne CRM-Zugang): Namen stehen, keine toten Links.

## Aufgaben wie Monday/ClickUp (28.09.2026 abends, B1, nur lokal)

- **Neue Aufgaben-Seite** `/os/aufgaben`: oben Schnell anlegen (Titel tippen, per Klick Space › Projekt › Liste › übergeordnete Aufgabe, vorbelegt mit dem, was offen ist; Kürzel !! · @malin · #projekt · Datum wie bisher). Darunter Privat | Business, im Business die Firmen (Selbstständigkeit · KD Ventures · MAKE OS UG) und die Mandanten (jede Firma mit aktivem Mandat; beendet → „Archiv“). Im Space Projekte → Listen → Aufgaben → Unteraufgaben (aufklappbar), ohne Projekt/Liste „Sonstige“. Ansicht Liste oder Board nach Status; Filter Alle/Meine, Status, fällig.
- **Detail:** Status (Offen · In Arbeit · Wartend · Erledigt + eigene je Space mit Farbe und Grundstatus), Zuständig, Priorität, Start, Deadline, Ort, Beschreibung, Verknüpfung mit Kontakt/Firma/Mandat/Deal (Link in die Akte), Unteraufgaben, Kommentare mit @-Erwähnung.
- **Bestand wird übernommen** (beim ersten Speichern): jede Aufgabe bekommt ihren Space, alte Unterpunkte werden Unteraufgaben — nichts geht verloren. Das alte Board mit Zeitstrahl/Delegation bleibt unter „Zeitstrahl ›“.
- **Sicherheit:** Aufgaben lesen/schreiben nur noch der Haushalt des Inhabers (vorher ohne Prüfung); gleichzeitige Änderungen am selben Eintrag → Hinweis statt Überschreiben; Änderungsprotokoll ohne Werte.
- **Glocke:** Zuweisung an die andere Person, @-Erwähnung und Kommentar melden sich (nie an sich selbst).
- **CRM:** Kachel „Aufgaben“ in Kontakt öffnen und in der Firmenakte (+ Aufgabe, beim Mandanten gleich im richtigen Space); Übergabe verknüpft die Aufgabe mit Kontakt/Deal/Mandat; Datenqualität meldet tote Verknüpfungen; ein Fokus-Block auf eine Aufgabe mit Mandat zählt auf das Mandat.
- **Dashboards:** Aufgaben-Widgets auf Privat-Flächen zeigen nur Privates, auf Business-Flächen nur Business.
- Tests: `tests/aufgaben-struktur.test.ts`, `tests/aufgaben-route.test.ts`, `tests/aufgaben-crm-flaechen.test.ts`, erweitert Verbindungen/Person-Bestände/Übergabe/Mandat-Bezug.

### Prüfliste (vor dem Hochladen durchklicken)
- [ ] Aufgaben › Business › Mandant: „+ Projekt“ Buchhaltung, „+ Liste“ Januar/Februar, Aufgabe „Fehlende Belege“ mit zwei Unteraufgaben; Haken setzen, zuklappen, neu laden — alles steht.
- [ ] Schnell anlegen: Titel + Projekt/Liste per Klick, Enter; ohne Auswahl landet sie unter „Sonstige“; „@malin morgen !!“ setzt Zuständig, Datum, Priorität.
- [ ] Status verwalten: „Beim Steuerbüro“ (Grundstatus Wartend) anlegen, im Detail und im Board (Karte ziehen) setzen.
- [ ] Detail: CRM-Verknüpfung suchen („mueller“ findet „Müller“), Link öffnet die Akte; Kommentar mit @Malin → Malins Glocke leuchtet.
- [ ] Zu zweit: dieselbe Aufgabe in zwei Fenstern ändern → zweites Fenster zeigt den Hinweis, nichts überschrieben.
- [ ] Alter Bestand: vorhandene Aufgaben stehen im passenden Space (Privat/Selbstständigkeit/KD Ventures), frühere Unterpunkte als Unteraufgaben.
- [ ] Kontakt öffnen / Firmenakte: Kachel „Aufgaben“, „+ Aufgabe“; Home/Übersichten: Privat-Aufgaben nur links bzw. auf Privat.
- [ ] Handy (375 px): Aufgaben-Seite, Detail öffnet oben, „⋯“ an Projekt/Liste.

## Finanzen: eine Einheitenliste (28.09.2026 abends, nur lokal)

- **Überall dieselben Einheiten:** Privat · Selbstständigkeit · KD Ventures · MAKE OS UG (aus `lib/einheiten.ts`) im Business-Cockpit, bei Steuern, im Szenario-Baukasten, in den Privat-Finanzen (Beleg-Einheit), bei Buchungen, in ZOE, in der Kontaktakte (Umsatz) und an den Liquiditäts-Pillen. „Consulting“ heißt in den Listen jetzt „Selbstständigkeit“.
- **Cockpit:** neue Sicht „MAKE OS UG“ (Köpfe, Jahresziel, Monatsabschluss auch für die UG). Die Gesamtsicht nimmt die UG erst dazu, wenn sie einen Monatsabschluss hat — bestehende Gesamtzahlen bleiben gleich.
- **Steuern:** die UG steht im Filter, in Rücklage und Prognose — aber ohne Fristen und ohne geschätzten Betrag („Steuerlogik der MAKE OS UG noch nicht hinterlegt“). Hinweis, keine Steuerberatung.
- **Baukasten:** „Wo“ kennt jetzt die Selbstständigkeit als eigene Einheit (Produkte der Selbstständigkeit landen dort statt bei der UG). Gerechnet wird wie bisher über die UG, weil der Rechenkern v3 keine eigene Selbstständigkeits-Spalte hat — Kevins Entscheidung, ob er eine bekommt.
- **Privat-Finanzen:** die frühere Einheit „KD Management UG“ ist die KD Ventures und heißt jetzt so; die MAKE OS UG ist neu wählbar. Alte Bestände werden beim Lesen übersetzt, beim nächsten Speichern neu geschrieben.
- **Buchungen:** eine bezahlte UG-Rechnung bucht bei der UG (vorher Selbstständigkeit); Filter „MAKE OS UG“ in Buchungen; „Geschäftlich“ umfasst alle drei. Bereits gebuchte Eingänge bleiben, wie sie sind.
- Tests: `tests/finanz-einheiten-summen.test.ts` (Summen vor/nach dem Umbau).
- **Nachtrag (b264b72):** Beleg aus ZOE übernehmen rechnet auf den Cent (vorher Rechnung auf ganze Euro), netto/USt über `lib/finanzen/ust.ts`, ein reiner Nettobetrag wird nicht mehr als brutto gebucht. Prüfliste Privat/Business bietet beim Zuordnen jetzt auch die MAKE OS UG (neben Selbstständigkeit · KD Ventures · KEMARIS). Prüfen: Beleg-Foto in ZOE → „als Rechnung“ zeigt Cent-Betrag; Zahlen › Privat › Prüfliste: Auswahl enthält „gehört zu: MAKE OS UG“.

### Prüfliste (vor dem Hochladen durchklicken)
- [ ] Zahlen › Business: Sichten Gesamt · Selbstständigkeit · KD Ventures · MAKE OS UG; Gesamt-Index unverändert gegenüber vorher.
- [ ] Zahlen › Business › Einstellungen: UG-Spalte speichern; Monatsabschluss für die UG anlegen und wieder löschen.
- [ ] Zahlen › Steuern: Filter „MAKE OS UG“ zeigt „noch nicht hinterlegt“; Rücklage-Summe unverändert.
- [ ] Finanzplanung › Planen › Baukasten: Baustein auf „Selbstständigkeit“ stellen → Zahlen gleich wie bei UG.
- [ ] Zahlen › Privat › Belege: Einheit-Auswahl zeigt vier Einträge; ein alter „KD Management UG“-Beleg steht als KD Ventures.
- [ ] Buchungen: Filter „MAKE OS UG“; Summe „Geschäftlich“ wie vorher.

## Mandat an Zielen und Zeit (28.09.2026 abends, nur lokal)

- **Mandat-Chip** (aktive Mandate, Suche „Firma · Mandatstitel“) im Business: bei Zielen und Meilensteinen beim Anlegen und am Eintrag, in der Zeitmessung neben Aufgabe und Einheit (Kopf beim laufenden Fokus, Fokus › Fokus-Blöcke). Ist ein Mandat gesetzt, kommen Firma und Einheit aus dem Mandat (Gesellschaft → Selbstständigkeit · KD Ventures · MAKE OS UG). Privat kennt keine Mandate.
- **Zeit je Mandat** (Fokus-Seite, neue Karte): Woche/Monat, je Person und gesamt; mit Monatshonorar ein grober Hinweis „≈ €/h“ — kein Rechnungsbezug. In der Mandatsakte (Produkte & Mandate) steht „Zeit“ des laufenden Monats.
- **Verbindungsprüfung:** Ziele, Meilensteine und Fokus-Blöcke mit gelöschtem Mandat/Firma werden gemeldet; „Bezug entfernen“ nimmt nur den toten Verweis weg (Zeit und Einheit bleiben). Ein Mandat lässt sich weiterhin löschen — die Zeit zählt dann als „Mandat (gelöscht)“.
- Tests: `tests/mandat-bezug.test.ts`, erweitert `tests/crm-verbindungen.test.ts`.

### Prüfliste (vor dem Hochladen durchklicken)
- [ ] Planung › Jahr › Business: neues Ziel mit „+ Mandat“ → Einheit springt auf die Gesellschaft des Mandats; nach Neuladen steht das Mandat am Ziel; abgeleitete Quartals-/Monatsziele tragen es mit.
- [ ] Meilenstein im Business mit Mandat anlegen; am Eintrag Mandat wechseln und entfernen.
- [ ] Kopf: Fokus starten (Business) → Etikett → Mandat wählen → stoppen → Fokus › „Zeit je Mandat“ zeigt die Zeit; Mandatsakte zeigt „Zeit“ im Monat.
- [ ] Fokus-Blöcke: Block nachträglich einem Mandat zuordnen; „nach Privat“ → Mandat weg.
- [ ] Malin (ohne CRM-Zugang? — nur wenn nicht im Haushalt des Inhabers): kein Mandat-Chip, nichts bricht.
- [ ] Stammdaten › Datenqualität: nach Löschen eines Test-Mandats erscheinen die drei Befunde; „Bezug entfernen“ räumt sie ab.

## Querschnitt-Lücken: UG-Rechnungen, Gesellschafts-Filter, Meilenstein-Space, Einheit am Block (28.09.2026 abends, nur lokal)

- **Rechnung aus dem Mandat bei der richtigen Gesellschaft:** „+ Rechnung aus dem Honorar“ legte Rechnungen aus UG-Mandaten bei kdc an. Jetzt folgt `firmaId` der Gesellschaft des Mandats (`firmaFuerGesellschaft` in `lib/einheiten.ts`: kdc · kdv · ug, „offen“ → kdc).
- **UG-Konto im Finanzplan:** ein neuer Plan startet mit drei leeren Konten (kdv, kdc, ug — ohne Bank, zählt 0 €). Ein bestehender Plan bekommt das leere UG-Konto beim Speichern, sobald der erste Posten bei ug steht (`ugFirmaNachziehen`, additiv, vorhandene Konten unverändert; das Lesen schreibt weiterhin nie).
- **Mandate nach Gesellschaft filtern:** Produkte & Mandate › Mandate hat neben dem Personen-Filter „Alle · Selbstständigkeit · KD Ventures · MAKE OS UG“ (am Handy Kürzel); „+ Mandat“ übernimmt die gefilterte Gesellschaft.
- **Meilensteine mit echtem Space:** Feld `space` (Privat/Business) statt der Ersatzlösung `bereich` (Business/Gesundheit). Alte Einträge werden gelesen (Gesundheit → Privat); beim Speichern steht beides, damit Brain, Loop, Gesundheits- und Business-Säule unverändert weiterlaufen. In „Alle“ wechselt ein Klick auf die Plakette den Space (wie bei Zielen). Säuberung jetzt in `lib/planung/meilensteine.ts`.
- **Einheit am Block der Wochenvorlage:** Routine-Planer › Blöcke — Business-Blöcke tragen optional eine Einheit (Auswahl wie bei Routinen, „+ neu“ inklusive), angezeigt als Kürzel (Selbst. · KDV · UG) unter der Uhrzeit; Privat verwirft sie.
- Tests: `tests/querschnitt-2809.test.ts`; `tests/k1-seed.test.ts` erwartet das UG-Konto im Startbestand.

### Prüfliste (vor dem Hochladen durchklicken)
- [ ] Mandat mit Gesellschaft „MAKE OS UG“ → „+ Rechnung aus dem Honorar“ → Rechnung steht unter MAKE OS UG; im Finanzplan erscheint das UG-Konto (leer), vorhandene Kontostände unverändert.
- [ ] Mandatsliste: Filter „KD Ventures“ zeigt nur KDV-Mandate; „+ Mandat“ im Filter legt ein KDV-Mandat an.
- [ ] Jahr › Meilensteine: alter Gesundheits-Meilenstein erscheint unter Privat; Plakette in „Alle“ wechselt Privat ↔ Business; Gesundheits-Cockpit zeigt ihn weiterhin.
- [ ] Routine-Planer › Blöcke: Business-Block → „+ Einheit“ → KDV; Kürzel sichtbar; Block auf Privat umschalten → Einheit weg.

## Glocke oben rechts: Meldungen (28.09.2026 abends, B2, nur lokal)

- **Glocke im Kopf** neben Heute · Inbox · Kalender (auch auf dem Handy): rote Zahl, solange etwas ungelesen ist; kommt etwas Neues dazu, leuchtet sie kurz rot und schwingt einmal (aus bei „Bewegung reduzieren“). Klick öffnet die Liste, neueste zuerst: Art-Symbol, Satz, Zeit („vor 5 Min“, „heute“, „überfällig“); ein Eintrag führt zur Aufgabe und gilt als gelesen; „Alle gelesen“ oben.
- **Gemeldet:** Zuweisung an mich, Kommentar, Erwähnung (kommen über `melde()` aus dem Aufgaben-Umbau B1) sowie eigene Aufgaben (zuständig ich oder gemeinsam), die heute fällig oder überfällig sind — die werden nicht gespeichert, sondern beim Öffnen aus den Aufgaben abgeleitet (Berliner Tag); „gelesen“ gilt für diesen Tag, morgen meldet sich eine noch offene überfällige Aufgabe wieder.
- **Regeln:** nie an sich selbst; je Aufgabe und Art eine ungelesene Meldung (eine neuere ersetzt sie); höchstens 500 je Person — erst fallen die ältesten gelesenen weg, ungelesene werden nie gelöscht, sondern zu „+N weitere Meldungen“ zusammengefasst. Nur eigene Meldungen, nur im Haushalt des Inhabers.
- **Sparsam:** Abfrage beim Öffnen, bei Fensterfokus und alle 60 s nur bei sichtbarer Seite, mit ETag (304 ohne Inhalt).
- **Telegram vorgesehen:** Schalter „Auch per Telegram“ unten in der Liste (aus) — es wird noch nichts gesendet; die Stelle für später ist `telegramHaken` in `lib/meldungen/speicher.ts`.
- Tests: `tests/meldungen-regeln.test.ts`, `tests/meldungen-route.test.ts`, `tests/meldungen-glocke.test.ts`.

### Prüfliste (vor dem Hochladen durchklicken)
- [ ] Kevin weist Malin eine Aufgabe zu → bei Malin (anderes Gerät/Fenster) wird die Glocke innerhalb einer Minute bzw. beim Zurückkehren ins Fenster rot mit „1“.
- [ ] Glocke öffnen → Eintrag anklicken → Aufgabe öffnet sich, Zahl sinkt; „Alle gelesen“ → Zahl weg.
- [ ] Eigene Aufgabe mit Deadline gestern → „überfällig“ in der Glocke; nach „gelesen“ heute ruhig, morgen wieder da (solange offen).
- [ ] Handy: Glocke im Kopf sichtbar, Liste passt in die Breite.
- [ ] Mit „Bewegung reduzieren“ pulsiert nichts.

## „Problem oder Idee melden“ in der Leiste (28.09.2026, nur lokal)

- Leiste unten links zwischen Brain und System (Handy: „Melden“): öffnet das Erfassen-Fenster (`make-idee`), Titel „Problem oder Idee melden“, Art Fehler · Idee · Wunsch, Seite geht mit, danach „Im Bauplan notiert“ mit Link. Test `tests/leiste-melden.test.ts`.

## Kartei-Protokoll für alle Schreibwege, ZOE-Kontext, Firmenwechsel im Import, Angebots-Ablauf (28.09.2026 spät, W7, nur lokal)

- **Änderungsprotokoll für jeden Kartei-Schreibweg:** neuer Helfer `aendereKontakte`/`aendereKontakteAsync` (`lib/crm/kartei-schreiben.ts`) — eine Sperre über `updateJson('kontakte')`, danach `listenDiff` ins Protokoll (wer, wann, Kennung als `c#…`, Feldnamen, nie Werte; der Stand vorher wird tief kopiert, weil manche Wege die Liste an Ort und Stelle ändern). Umgestellt: Aktivität (auch Notiz ändern/löschen), Follow-up (Aktivität, Verschieben, Absagen), Lead (Personen-Lead, Mandat → Phase), Kampagnen, Netzwerk, Anfrage, Stammdaten, Umzug, Verbindungen, Signale, Heads (Rücknahme, Übernahme), Deal anlegen, Übergabe, Lead heben, Heads-Lauf (Auto-Übernahme, als „zoe“), Angebot stellen, ZOE `notiere_kontakt` (als „zoe“ mit Person). `uebergeben`, `dealAnlegen`, `leadHebenNachGespraech` nehmen optional `wer` (Routen: `werAus(req)`, ZOE: `{ art: 'zoe', person }`). Schon vorher protokolliert und unverändert: Kartei-PATCH, Import (+ Konflikt, Rückgängig), Dubletten, Datenschutz, Firmen-Abgleich, Löschfristen-Lauf, `aendereCrm`.
- **Sperr-Reihenfolge crm → kontakte:** `aendereKontakte` nimmt nie die CRM-Sperre; aus `aendereCrm` heraus darf es aufgerufen werden. Test mit gleichzeitigem `aendereCrm` (Lead-Folge) und `aendereKontakte`.
- **Wache:** ein Test sucht in `app/` und `lib/` jeden direkten Schreibzugriff auf „kontakte“ — erlaubt nur der Helfer, `aendereCrm` und die selbst protokollierenden Stellen.
- **ZOE-Kontext:** `gatherBrain` nimmt Kunden/Mandate (`kundenAusMandaten`) nur noch für Personen im Haushalt des Inhabers (`personImHaushaltDesInhabers`) — ein Konto aus einem anderen Haushalt bekommt davon nichts, auch keine Zahlen.
- **Import-Konflikt „Firmenwechsel?“:** Stammdaten › Import zeigt den Hinweis sichtbar an der Zeile. „Liste übernehmen“ beim Feld Firma schrieb bisher nur den Firmentext (kein Fehler, aber der neue Name stand über der alten Hauptstation). Jetzt fragt die Oberfläche wie im Kontakt: Jobwechsel · Zusätzliche Firma · Korrektur; der Server findet oder legt die Firma an (CRM zuerst, dann Kartei) und rechnet die Stationen. Ohne Absicht bei einer Person mit Hauptstation: 409 `firmaWechselNoetig` (die Oberfläche fragt dann nach). Ohne Hauptstation wie bisher.
- **Angebote laufen auch ohne Öffnen ab:** der tägliche Morgenlauf (`POST /api/tagesstart`, neuer Schritt „Angebote“ vorneweg) ruft `ablaufNachziehen` — gestellte Angebote nach „gültig bis“ → abgelaufen. In derselben Sperre der Follow-up-Hinweis „Angebot abgelaufen — nachfassen oder Version 2“: ein offenes „Angebot nachfassen“ bekommt den Hinweis und wird heute fällig, sonst ein neues Follow-up (einmal je Angebot, nicht für eingeschränkte Personen). Gilt auch, wenn das Lesen (GET bestand/angebot) zuerst nachzieht.
- Tests: `tests/kartei-schreibwege-w7.test.ts`, `tests/brain-kunden-haushalt.test.ts`, `tests/import-konflikt-firmenwechsel.test.ts`, `tests/angebot-ablauf-tagesstart.test.ts`.

### Prüfliste (vor dem Hochladen durchklicken)
- [ ] Aktivität an einem Kontakt festhalten → das Änderungsprotokoll (`GET /api/state/aenderungen`) hat den Eintrag (wer, Felder), ohne Inhalt.
- [ ] Import mit einer Person, deren Firma in der Liste anders heißt → Zeile trägt „Firmenwechsel?“; „Liste übernehmen“ fragt Jobwechsel/zusätzlich/Korrektur, danach stimmt die Firmenkarte.
- [ ] Ein gestelltes Angebot mit „gültig bis“ gestern → nach dem Morgenlauf „abgelaufen“ und ein Follow-up „nachfassen oder Version 2“.
- [ ] ZOE als Konto eines anderen Haushalts fragen → keine Mandatszahlen in der Antwort.

## CRM-Speicher: Folgen in derselben Sperre, Personen-Schranke, Kriterien-Grenze (28.09.2026 spät, nur lokal)

- **Deal-Fehlanlage löschen:** der Lead, der per `chanceId` auf den Deal zeigte, geht in derselben Sperre zurück auf „Qualifizierung“ (`chanceId`/`sqlAm` weg) — Firmen-Lead im CRM-Bestand, Personen-Lead (Person ohne Firma) in der Kartei. Vorher zählte die Firma weiter in „Neue SQL · 30 Tage“ und im Trichter. Gilt für jeden Schreibweg über `aendereCrm` (Regeln in `lib/crm/bestand-folgen.ts`).
- **Server nimmt keine Gesperrten mehr an:** neue Personen-Verweise in Teilnahmen (Einladungen), Kampagnen-Kontakten (aktiv/Entwurf), Deals und Mandaten prüft `wendeCrmAn` (`lib/crm/personen-schranke.ts`): Art. 18 → 409 mit dem Einschränkungs-Text; Werbesperre → 409 mit Grund bei Kampagnen/Einladungen, bei Deals/Mandaten erlaubt (Vertragsbeziehung). Wer schon drinsteht, wird nicht rückwirkend abgelehnt. Die Kartei liest `aendereCrm` in der CRM-Sperre — keine Route muss sie durchreichen.
- **Nie abschneiden:** Segment-Kriterien (Typ, Kategorie, Label, Kreis …, auch Kampagnen-Zielgruppe) höchstens `KRITERIEN_WERTE_MAX` (500) Werte, darüber 413 — vorher still nach 50 gekürzt.
- **Firma umbenannt:** `Mandat.kunde` und `Chance.firma` ziehen in derselben Sperre mit, wenn sie den alten Namen trugen; ein bewusst anderer Anzeigename bleibt. Hinweis: alte Rechnungen ohne `mandatId` finden ihr Mandat weiter über gemeinsame Namensteile (`rechnungPasst`) — bei einem ganz neuen Namen ohne gemeinsames Wort nicht mehr.
- Tests: `tests/crm-speicher-folgen.test.ts`.

### Prüfliste (vor dem Hochladen durchklicken)
- [ ] Deal als Fehlanlage anlegen und löschen → Firma steht unter Leads wieder auf „Qualifizierung“, „Neue SQL · 30 Tage“ zählt sie nicht mehr.
- [ ] Person mit Werbesperre in eine Kampagne bzw. auf eine Gästeliste nehmen → Meldung „Werbesperre … nichts gespeichert“; an einen Deal hängen → geht.
- [ ] Firma umbenennen → Mandat und Deal zeigen den neuen Namen.

## Integritätsprüfung Markttraktion: Zugang, Art. 17, Löschsperren, Datenschutz-Kette (28.09.2026 abends, nur lokal)

- **Zugang (K1, Regel 5):** `imHaushaltDesInhabers` prüft beim Dienstweg jetzt auch die genannte Person (Haushalt des Inhabers) und fällt ohne Person nicht mehr auf „kevin“ zurück (→ 403). Systemläufe ohne Person gehen nur, wo die Route sie trägt: Kalender lesen (`kalenderLesen`, Zulieferer vom Mac), Erinnerungen, Kartei (`karteiZugang`), Inhaber-Dinge (`nurInhaber`, unverändert). CRM-Routen `bestand`, `deal`, `followup`, `kampagnen`, `netzwerk` nehmen die Person aus dem Zugang; `lead`/`aktivitaet`/`import` sind über den Wächter mit abgedeckt. Heads-Routen (`/api/heads/*`, `/api/heads/eval`) waren offen — jetzt nur im Haushalt des Inhabers. **Ohne `konten.json` (frischer Server):** niemand ist im Haushalt → alle Haushalts-Routen 403 (anmelden geht dort ohnehin nicht); Systemläufe (Kalender lesen, Erinnerungen, Kartei, Postfach/Whoop über `nurInhaber`) laufen weiter.
- **ZOE (K1):** Markttraktion-Werkzeuge (`crm_lage`, `suche_kontakt`, `notiere_kontakt`, `entwurf_ansprache`, `chance_anlegen`, `uebergeben`, `setze_kunde`) und Agenten, die die Kartei lesen (`crm`, `outreach`, `prospect`, Heads), bietet kimmi nur einer ausdrücklich benannten Person im Haushalt des Inhabers an; jedes Werkzeug prüft zusätzlich selbst (auch Stapel-Freigabe, Rücknahme, Aufträge). **`setze_kunde`** trifft nur den genauen Namen (Rechtsform egal) oder die `mandat_id`, sonst Rückfrage; geschrieben wird über den normalen Mandat-Weg (Säuberung, Grenzen).
- **Art. 17 (K2):** Löschen nimmt den vollen Namen auch aus Deal-Titeln und Mandats-Kunden („[gelöscht]“); gibt es eine andere Person gleichen Namens, nur dort, wo die gelöschte verknüpft war.
- **Firmen abgleichen (W1):** tote `firmaId` gilt als leer und wird per Firmennamen neu verknüpft (vorhanden oder neu); eine Hauptstation mit gelöschter Firma ebenso. Andere tote Stationen (ohne Namen) meldet weiter die Verbindungsprüfung.
- **Import (W4):** nennt die Liste eine andere Firma, wird nichts überschrieben — Konflikt „Firmenwechsel?“ (Feld Firma, dazu Position) unter Stammdaten › Austausch; gleiche Firma in anderer Schreibweise bleibt, wie sie ist. Mögliche Dubletten werden nicht mehr bei 300 abgeschnitten.
- **Löschen (W6):** Sperre (409 mit Anzahlen) auch für Produkte mit Deals/Mandaten („auf eingestellt setzen“), Segmente in Events/Kampagnen, Beiträge in Newslettern; Firmen/Mandate zählen zusätzlich Dateiablage-Einträge und offene Follow-ups. **Event löschen** läuft über den Server (`POST /api/crm/events { aktion: 'loeschen' }`): Teilnahmen weg, offene Follow-ups des Events abgesagt — in einer Änderung; allein über den Bestand → 409.
- **Datenschutz-Kette (W8):** Fällig-Liste/Power Hour ohne werbliche Follow-ups (Mail, LinkedIn, Anruf, Nachricht außerhalb Deal/Mandat) an Personen mit Werbesperre — mit Hinweis. LinkedIn-Schritte: Art. 18 → 409; Werbesperre → keine Anfrage/Nachricht, ein „Ja“ hebt sie nicht auf; das „Ja“ wird Einwilligung mit vollem Nachweis (Wortlaut, Beleg, Zeitpunkt, wer). Follow-up-Route: Art. 18 → 409; `geaendertAm` am Kontakt ist der Berliner Tag.
- **Beleg einer Einwilligung (W10):** eine Datei, auf die eine Einwilligung zeigt (`belegRef` d-…, auch widerrufen), lässt sich nicht löschen (409 mit Grund).
- **Verbindungsprüfung, 11 neue Prüfungen:** Firmentext ≠ Hauptstation (reparierbar: „Firmennamen übernehmen“), Typ nicht vorn (reparierbar), doppelte Teilnahmen (reparierbar: zusammenführen, nichts geht verloren), Aktivität → gelöschte Firma/Bezug, Deal-Quelle tot, Mandat → Planposten tot, Mandats-Phase ungültig, Kampagnen-Ergebnis außerhalb, Head-Vorschlag → gelöschte Person, Einwilligungs-Beleg tot. Reparatur „Lead zeigt auf gelöschten Deal“ setzt „SQL“ zurück auf „Qualifizierung“.
- **Nie abschneiden:** Dateiliste liefert alle Einträge (vorher 500); LinkedIn-Export > 5 MB → 413; Kampagne übernimmt die ganze Zielgruppe (vorher still 40, Meldung nennt die Anzahl); Lead-Notiz aus Kampagnen wird nicht mehr gekürzt oder ersetzt (voll → Hinweis).
- Tests: `tests/integritaet-zugang.test.ts`, `tests/integritaet-crm.test.ts`, Fälle in `tests/crm-verbindungen.test.ts`; Route-Tests mit Konten im Haushalt + Negativfall (Dienstweg ohne/mit fremder Person → 403).

### Prüfliste (vor dem Hochladen durchklicken)
- [ ] Als Kevin und als Malin: Markttraktion lädt (Überblick, Kontakte, Deals, Follow-up, Heads-Panel), ZOE „Wen soll ich heute anrufen?“ antwortet mit Namen.
- [ ] Kalender und Tagesstart laufen wie bisher (Zulieferer/Takt ohne Person).
- [ ] Event mit Gästen löschen → Meldung nennt entfernte Teilnahmen/abgesagte Follow-ups.
- [ ] Stammdaten › Datenqualität: neue Befunde ansehen, „Firmennamen übernehmen“ nur nach Blick auf die Beispiele.

## Ablaufprüfung Markttraktion: Meldungen, Schreibkette, Rückgängig, Art. 18 (28.09.2026 abends, nur lokal)

- **Meldungen bleiben stehen (K1):** „Nicht gespeichert — dieser Eintrag/Kontakt wurde inzwischen geändert. Die Anzeige zeigt jetzt den aktuellen Stand. Bitte erneut eingeben.“ steht unten fixiert (Toast), bis weggeklickt, ~8 s vergangen oder neu geschrieben wird — das Neuladen löscht sie nicht mehr (auch „Mandat anlegen“, Einschränken/Aufheben). Ergebnis-Hinweise (z. B. nach dem Löschen) bleiben, bis sie weggeklickt werden.
- **Kontakt-Änderungen nacheinander (K2):** zwei schnelle Klicks (z. B. zwei Häkchen) scheitern nicht mehr an sich selbst — jede Kontakt-Änderung, Aktivität und Netzwerk-Schritt läuft in einer Kette, der Stand kommt beim Absenden aus der letzten Server-Antwort; bei 409 übernimmt die Anzeige den aktuellen Eintrag (`lib/crm/kontakt-schreiben.ts`).
- **Deal-Ampel (W1):** eine Aktivität mit Bezug auf einen offenen Deal (oder bei genau einem offenen Deal der Person) setzt „letzte Aktivität“ am Deal auf heute. **Ergebnis „Sperre“:** offene Mail-/LinkedIn-/Anruf-Follow-ups werden mit Grund abgesagt, die Person verlässt laufende und geplante Kampagnen.
- **„+ Aktivität hinzufügen“ (W2):** ein angelegter Deal wird beim erneuten Speichern nicht doppelt angelegt; „Einwilligung für Mail“ meldet sich nur, wenn sie wirklich gespeichert ist (sonst bleibt ein Hinweis stehen).
- **Löschen (Art. 17, W3):** danach steht, welche Deals jetzt ohne Person sind und wie viele Aufgaben den Namen noch nennen.
- **Dubletten (W4):** vor dem Zusammenführen steht, was wandert (Deals, Aktivitäten, Follow-ups, Dateien, Einwilligungen, Kampagnen); **Rückgängig 30 Tage** unter Kontakte › Dubletten › „Zusammengeführt“ — nur, solange niemand die Einträge seitdem geändert hat (sonst Grund). Zu lange private Notizen oder zu viele Einträge → Ablehnung statt Kürzung.
- **Import:** Konflikt „Liste übernehmen“ geht über den Kartei-Weg (Typ → Typen, Position → Rolle der Hauptstation, Art. 18, Protokoll); offene Konflikte früherer Listen bleiben erhalten; „Import rückgängig“ nimmt vom Import neu angelegte Firmen mit (nur frei und unverändert) und erkennt Verknüpfungen auch in Dateien, Heads, Terminen und Aufgaben.
- **Deals/Mandate:** eingeschränkte Personen (Art. 18) bekommen keinen Deal, kein Mandat, keinen Lead-Schritt (409); gesetzte Lifecycle-Phase unter „Opportunity“ wird mit dem Deal gehoben; Deal-Titel ohne Firma ohne vollen Namen („Deal · Retainer · M.“), Mandat-Kunde ohne Firma = „Privatkunde“; über 20 Personen → Ablehnung statt Kürzen.
- **Kleineres:** Power Hour zeigt Deals/Mandate ohne Person über eine Person der Firma (sonst gezählt); Runden-Rückgängig ändert nur die drei Felder; Firmenvorschläge ungekürzt mit Suche; Neuanlage (Kartei, Visitenkarte, Einlass, Anfrage) prüft die Sperrliste → Werbesperre + Hinweis, nicht blockiert; Anfragen finden Dubletten über alle Adressen und verlieren in der Lead-Notiz nie das Neueste; Akte zeigt bei Ladefehler „Neu laden“ statt „gibt es nicht mehr“.
- Tests: `tests/crm-kontakt-schreiben.test.ts`, `tests/crm-ablauf-reparatur.test.ts`, `tests/crm-ablauf-routen.test.ts`.

### Prüfliste (vor dem Hochladen durchklicken)
- [ ] Zwei Fenster, dieselbe Person: in beiden ein Feld ändern → im zweiten steht die Meldung unten und bleibt, der Wert zeigt den aktuellen Stand.
- [ ] Kontakt › zwei Labels schnell hintereinander anklicken → beide gespeichert, keine Meldung.
- [ ] Kontakte › Dubletten: „Erste behalten“ → Rückfrage mit „Es wandert …“ → zusammengeführt → unten „Zusammengeführt“ → Rückgängig → beide wieder da.
- [ ] Stammdaten › Austausch: einen Konflikt „Liste“ übernehmen; einen Import zurücknehmen (Meldung nennt auch entfernte Firmen).

## Angebots-Tool: Gesellschaften, Angebotstexte, Angebot → PDF + Mail (28.09.2026 abends, A1, nur lokal)

- **Markttraktion › Angebot** (Knopf „Angebot“ bzw. „Angebot erstellen“ in Kontakt, Deal-Akte und Umsatz-Reiter, jeweils vorbelegt): eine Seite — 1 Für wen (Schnellsuche; Firma, offener Deal und Gesellschaft kommen von selbst) · 2 Was (aktive Produkte als Karten, ein Klick = Position; Menge/Preis/Rabatt/USt/Basis/Laufzeit direkt in der Zeile, Enter springt weiter, Text aufklappbar; „+ freie Position“) · 3 Rahmen (Einleitung/Schluss aus der Vorlage mit Sie/Du, gültig bis, Zahlungsziel). Unten die feste Summenleiste (einmalig · monatlich · jährlich · Gesamtwert). Der Entwurf speichert von selbst.
- **„Mail versenden“** → Vorschau: links der Mail-Entwurf (An, Betreff „Angebot {Nummer} – Titel“, Text), rechts das Angebot im Layout des PDFs. **Senden** stellt das Angebot (Nummer je Gesellschaft und Jahr, lückenlos; danach festgeschrieben), erzeugt das PDF (verschlüsselt in der Dateiablage, mit Prüfsumme), lädt es herunter und öffnet das Mail-Programm — **PDF anhängen und abschicken**. MAKE OS versendet weiterhin nichts selbst.
- **Verbunden:** Deal auf Stufe „Angebot“ (vorhanden oder neu) mit Wert aus dem Angebot · Follow-up „Angebot … nachfassen“ (+5 Werktage, änderbar) · Aktivität „Angebot … gesendet“ am Kontakt · BEAN „Angebotskunde“ · Lifecycle hebt sich. **Angenommen** → Deal gewonnen → „Mandat anlegen“ vorbelegt (Honorar, Laufzeit, Produkt, Gesellschaft). **Abgelehnt** → Verlustgrund Pflicht, Deal verloren. **Neue Version** → Entwurf mit Bezug, die alte wird beim Stellen „ersetzt“ (bleibt lesbar). Abgelaufen automatisch nach „gültig bis“. Liste „Angebote“ mit Filter Status, Gesellschaft, Suche.
- **Kanal-Ampel vor dem Senden:** Werbesperre/Einschränkung (Art. 18/21) sperrt mit Grund; gelb = Hinweis (angefragtes Angebot = Vertragsanbahnung). Hinweis, keine Rechtsberatung.
- **Stammdaten › Gesellschaften** (neu): Selbstständigkeit · KD Ventures · MAKE OS UG — Firmierung, Anschrift, Kontakt, Steuernummer/USt-IdNr., Geschäftsführung/Register, Bank (IBAN nur maskiert, im PDF voll), Kleinunternehmer, Zahlungsziel, Gültigkeit, Nummernformat (`{KURZ}-A-{JAHR}-{NR4}`), Logo (PNG/JPG), Fußtext. **Ohne Firmierung und Anschrift sperrt das Senden** — Kevin trägt die echten Werte selbst ein.
- **Produkte brauchen Angebotstexte:** Produkt › Angebotstexte (Titel, Einleitung, **Leistungstext**, Ergebnis, Hinweise). „aktiv“ erst mit Leistungstext (Server 409); bestehende aktive ohne Text bleiben aktiv und stehen im Tool als „Text fehlt“ (+ Hinweis in der Verbindungsprüfung).
- Umsatz-Reiter: Kachel „Angebote“ zeigt die Tool-Angebote (Altbestand bleibt lesbar), „+ Angebot“ öffnet das Tool. Neue Abhängigkeit `pdf-lib@1.17.1` (fest).
- Tests: `tests/angebote.test.ts`, `tests/angebot-route.test.ts` (Nummern parallel, festgeschrieben, Version, Ablauf, PDF-Text, Verbindungen, Ampel, 403/409), `tests/angebot-oberflaeche.test.ts` (zeichnet ohne Fehler), Verbindungsprüfung (4 neue Prüfungen).

### Prüfliste (vor dem Hochladen durchklicken)
- [ ] Stammdaten › Gesellschaften: je Gesellschaft Firmierung, Anschrift, Steuernummer/USt-IdNr., E-Mail, Bank eintragen; Logo hochladen; Nummernformat prüfen.
- [ ] Produkte & Mandate › Produkte: für jedes aktive Produkt den Leistungstext eintragen („Text fehlt“ verschwindet).
- [ ] Kontakt öffnen › Deals „Angebot erstellen“ → Produkt anklicken → Menge/Preis ändern → „Mail versenden“ → Vorschau prüfen → Senden: PDF kommt, Mail-Programm öffnet sich, Angebot hat seine Nummer; Deal steht auf „Angebot“, Follow-up ist da.
- [ ] Angebot öffnen → „Angenommen“ → „Mandat anlegen“ (Honorar/Laufzeit vorbelegt); ein zweites → „Abgelehnt …“ mit Grund.

## Markttraktion: Schnellknöpfe Qualifizierung + Angebot, „+ Aktivität hinzufügen“ (28.09.2026 abends, nur lokal)

- **Zwei Schnellknöpfe in der Mitte der Reiterleiste:** „Qualifizierung“ (orange) und „Angebot“ (grün), jeder für sich, ausbalanciert zwischen links (Überblick · Kontakte · Firmen · Deals · Follow-up) und rechts (Sales · Marketing · Make.One · Stammdaten). Sie pulsieren leise von hinten (bei „Bewegung reduzieren“ still), aktiv = kräftige Fläche mit voller Kontur. Qualifizierung ist dafür aus der rechten Gruppe in die Mitte gewandert.
- **Schmal (Laptop mit Leiste unter ~1.100 px Inhaltsbreite, Handy):** die zwei Knöpfe stehen als eigene Zeile über den Reitern; die Reiter bleiben wischbar, nichts läuft über (geprüft 1440, 1280, 375 px).
- **Neuer Bereich „Angebot“:** `/os/markttraktion?s=angebot` (optional `k=<Angebot>`, `kontakt=`, `firma=`, `deal=`), Untertitel „Angebot in einer Minute: Produkte anklicken, anpassen, senden.“ Inhalt kommt aus dem Angebots-Paket (A1). In der Schnellsuche: „Markttraktion · Qualifizierung“ und „Markttraktion · Angebot“.
- **Umbenannt:** „+ Gespräch festhalten“ → „+ Aktivität hinzufügen“ (Knopf im Kopf, Titel des Dialogs, Pflege-Link der Kennzahl „Echte Gespräche“). Verhalten unverändert.
- Tests: `tests/markttraktion-angebot.test.ts` (Adresse, Vorbelegung, alte Adressen, Reihenfolge der Leiste).

### Prüfliste (vor dem Hochladen durchklicken)
- [ ] Markttraktion am Rechner: Knöpfe mittig zwischen den Gruppen, beide pulsieren leise; Klick auf Angebot → grün aktiv, Untertitel passt; Klick auf Qualifizierung → Qualifizierungsrunde wie bisher.
- [ ] Am Handy: Qualifizierung + Angebot als Zeile oben, Reiter darunter wischbar, keine Querlaufleiste der Seite.
- [ ] „+ Aktivität hinzufügen“ öffnet den bekannten Dialog (Titel „Aktivität hinzufügen“), Speichern wie bisher.

## Datenschutz vollständig: Nachweis, Art. 18, Löschfristen, geprüft (28.09.2026, U2, nur lokal)

- **Einwilligung mit vollem Nachweis (#55):** Wortlaut und Beleg sind beim Erfassen Pflicht; Zeitpunkt (mit Uhrzeit) und wer sie aufgenommen hat, stempelt der Server. Einmal erfasst, bleibt eine Einwilligung unveränderlich — nur der Widerruf kommt dazu (mit Person). Kontakt › Stammdaten › Datenschutz zeigt den ganzen Nachweis und „Nachweis unvollständig“.
- **Altbestand:** alte Einwilligungen bleiben gültig, zählen aber als „unvollständiger Nachweis“ → Mail/LinkedIn/Einladung **gelb statt grün** (Grund nennt, was fehlt). Newsletter-Ampel unverändert (offene Frage). Mail an Bestandskunden (Mandat) wird **gelb**, bis „Hinweis bei Erhebung erteilt“ vermerkt ist.
- **Einschränkung nach Art. 18 als echte Sperre (#51):** setzen/aufheben mit Grund (Kontakt › Datenschutz oder Betroffenenantrag „Einschränkung“ mit verknüpfter Person — setzt sie beim Anlegen). Wirkung: Ampel rot, raus aus Heads/ZOE, Segmenten, Kampagnen, Qualifizierung, Power Hour, Follow-ups; Export nur mit Spalte EINGESCHRAENKT, Suche mit Kennzeichnung; Bearbeiten, Verlauf, Zusammenführen und Löschen gesperrt (Werbewiderspruch bleibt möglich). Verbindungsprüfung meldet eingeschränkte Personen in laufenden Kampagnen (reparierbar) und auf Einladungslisten.
- **Löschfristen je Datenart (#52):** Tabelle unter Stammdaten › Datenschutz (Vorschläge, anpassbar, Standard nie gespeichert). Täglicher Takt-Lauf: Kontakte über der Frist **nie automatisch gelöscht** — eine Aufgabe „n Kontakte über der Löschfrist — prüfen“, Liste mit „Frist verlängern mit Grund“; technische Bestände (Import-Konflikte 90 T, Import-Läufe 30 T, Heads-Replay 90 T, Signal-Texte 12 M, Änderungsprotokoll 36 M) werden bereinigt, Protokoll „System“.
- **„Zuletzt geprüft“ (#34):** Knopf „Stammdaten geprüft“; Datenqualität + Befund „n Kontakte seit über 12 Monaten nicht geprüft“ (aktive Beziehungen/Leads).
- **Telefon mit Anlass (#58):** bei gelber Telefon-Ampel verlangt „Anruf festhalten“ einen Anlass (gespeichert an der Aktivität). **Ereigniszeit (#46):** nachgetragener Anruf/Mail mit Tag; „letzter Kontakt“ und Verlauf nach Ereigniszeit.
- **Nachtrag (Kevins Antworten):** Newsletter mit Double-Opt-in ohne vollständigen Nachweis ist jetzt ebenfalls **gelb** (Segmente „Kanal grün“, Newsletter-Empfänger und Export folgen). Neue Karte unter Stammdaten › Datenqualität „Einwilligung ohne vollständigen Nachweis“: Anzahl je Kanal, Liste mit Link in die Kontaktseite (Stammdaten › Datenschutz) — zum Nachtragen von Hand, nichts automatisch.
- Tests: `tests/crm-u2-datenschutz.test.ts` (25 Fälle), Verbindungsprüfung (zwei neue Prüfungen), angepasste Ampel-Fälle.

### Prüfliste U2 (vor dem Hochladen durchklicken)
- [ ] Kontakt mit alter Einwilligung: Mail-Ampel gelb mit „Nachweis unvollständig (fehlt: …)“; unter Stammdaten › Datenschutz „+ Einwilligung“ nur mit Wortlaut + Beleg → danach grün, Eintrag zeigt „erfasst … von …“.
- [ ] Kunde mit Mandat: Mail gelb „Hinweis bei Erhebung fehlt“ → „Hinweis vermerken“ → grün.
- [ ] Testperson „Verarbeitung einschränken“ (Grund): Banner, Ampel rot, Schnellaktionen aus, Matrix speichert nicht (Meldung), Löschen gesperrt; „Aufheben (mit Grund)“ → alles wieder da, Verlauf zeigt beide Schritte.
- [ ] Betroffenenantrag „Einschränkung (18)“ mit einer Testperson anlegen → Person eingeschränkt; „Einschränkung aufheben“ im Antrag.
- [ ] Stammdaten › Datenschutz: Löschfristen-Tabelle, einen Wert ändern und „Standard“ zurück; Liste „über der Frist“ mit „Frist verlängern mit Grund“.
- [ ] Anruf festhalten bei einer bekannten Person ohne Einwilligung (gelb): Knopf erst mit Anlass aktiv; „Wann“ auf gestern → Verlauf zeigt gestern, „nachgetragen am …“.
- [ ] Aufgaben: nach dem Takt-Lauf (ab 7 Uhr) höchstens EINE Aufgabe „… über der Löschfrist“, ohne Namen.
- [ ] Stammdaten › Datenqualität: Karte „Einwilligung ohne vollständigen Nachweis“ mit Zahlen je Kanal; Link öffnet die Kontaktseite (Stammdaten); nach dem Ergänzen verschwindet die Person aus der Liste. Newsletter-Ampel alter DOI gelb.

## CRM grundsätzlich fertig: Stationen, mehrere Adressen, Konzern, Mehrfachwerte (28.09.2026, U1, nur lokal)

- **Person in mehreren Firmen mit Rolle und Beschäftigungshistorie:** Stationen je Person (Firma, Rolle, Art, von–bis, Hauptstation). „Firma wechseln“ beendet die alte Station, statt sie zu überschreiben; „+ weitere Firma“ (z. B. Beirat). Firmenkarte zeigt aktuelle und ehemalige Personen getrennt, die Zeitlinie einer Firma behält Aktivitäten, auch wenn die Person weitergezogen ist.
- **Mehrere E-Mail-Adressen je Person** (geschäftlich/privat/alt), Haupt-Adresse wählbar. Import hängt eine neue Adresse an eine bekannte Person an (nie überschreiben), Dubletten, Sperrliste und Suche prüfen alle Adressen.
- **Mutter- und Tochterfirmen:** Mutter in der Firmenkarte wählen, Töchter sichtbar, Deals/Mandate und Umsatz für die „ganze Gruppe“, BEAN der Gruppe. Kreise werden abgelehnt.
- **Typ, Kategorie mehrfach + Labels** (eigene Werte per „+ neu“), Segmente/Kartei-Filter/Export dazu. Werte an Personen, die in keiner Werteliste stehen, meldet Datenqualität als einen Hinweis — „In Werteliste aufnehmen“ legt sie an.
- **Firma ändern fragt nach** (Matrix-Feld „Firma“, Firmenkarte „+ zuordnen“): Jobwechsel (alte Station endet, Verlauf bleibt) · Zusätzliche Firma · Korrektur (falsche Firma ersetzen, ohne Historie). Ohne Angabe lehnt der Server bei gespeicherten Stationen ab — nie endet still eine Station. „Besitzer“ heißt jetzt „Zuständig“, der Reiter „Daten“ heißt „Stammdaten“.
- **Nie abschneiden:** Kampagnen-Ergebnisse/-Kontakte, Beitrags-Wirkung, Personen je Deal usw. werden nicht mehr still gekürzt — über hohen Grenzen wird abgelehnt. Import schreibt ins Änderungsprotokoll als „import“.
- **Altbestand geschützt:** Bestehende Kontakte/Firmen werden NICHT umgeschrieben. `firmaId`/`firma`/`position`/`email`/`typ`/`kategorie` bleiben und werden weiter befüllt; die neuen Listen entstehen erst, wenn jemand etwas daran ändert. Ein älteres Browserfenster kann sie nicht löschen.
- Tests: `tests/crm-stationen-emails.test.ts` (inkl. Migrationstest), `tests/crm-verbindungen.test.ts` (fünf neue Prüfungen), `tests/crm-import-route.test.ts` (Protokoll „import“, zweite Adresse).

### Prüfliste U1 (vor dem Hochladen durchklicken)
- [ ] Kontakt öffnen (beliebige Person aus dem Bestand): links E-Mail wie vorher, rechts Firma wie vorher, darunter „Stationen“ mit einer laufenden Hauptstation.
- [ ] Testperson: „+ Adresse“, Art wählen, „Haupt“ wechseln — die Kanal-Ampel und „Mail ↗“ folgen der Haupt-Adresse.
- [ ] Testperson: „Firma wechseln“ → alte Station unter „Ehemalig“ mit Enddatum, Firma oben neu; die alte Firmenkarte zeigt die Person unter „Ehemalig“ und die frühere Aktivität in der Zeitlinie.
- [ ] Firmenkarte: Mutterfirma wählen, bei der Mutter erscheinen die Töchter; eine Tochter als Mutter der Mutter → Hinweis „Kreis“.
- [ ] Wichtigste Infos: Typ/Kategorie mehrfach, Labels mit „+ neu“; Stammdaten › Wertelisten zeigt „Labels“.
- [ ] Import der Masterliste (Vorschau): „weitere Adressen“ statt neuer Personen, wo nur die Mail neu ist.
- [ ] Testperson mit Firma: Matrix-Feld „Firma“ ändern → Menü Jobwechsel/Zusätzlich/Korrektur; jede Wahl einmal, Abbrechen ändert nichts.
- [ ] Stammdaten › Datenqualität: Hinweis „Werte außerhalb der Wertelisten“ → „In Werteliste aufnehmen“ → Hinweis weg, Werte stehen unter Wertelisten.

## Team aus den Daten (28.09.2026, U4, nur lokal)

- **Team steht im Speicher, nicht im Code:** Bestand `team--<haushalt>` (über `local-db`, also verschlüsselt) mit `{ id, name, kurz, rolle, bereich?, email?, aktiv, farbe?, kreis? }`. Kevin und Malin sind feste Einträge aus den Konten des Haushalts (`konto-<speicher>`: Name aus dem Konto, Kurzwort/Rolle/Bereich pflegbar). Route `GET/PATCH /api/team` (Haushalt des Inhabers + Person nötig, sonst 403; Einzeländerungen mit Stand über `listePatchen`, veraltet → 409 mit aktuellem Team; ETag → 304; Löschen gibt es nicht, nur Deaktivieren; Kurzwort ein Wort und eindeutig).
- **Gepflegt in der Karte „Team — wer was trägt“** (Säule Familie & Partnerschaft, `/os/saeule/social`, `components/os/TeamKarte.tsx`): anlegen, ändern, deaktivieren. Leerer Speicher → Hinweis „Team einmal eintragen“, bis dahin Rollen-Platzhalter. Keine automatische Übernahme alter Namen.
- **Leser:** Aufgaben (Abgeben-Liste, Delegations-Runde, Marker „— Delegiert an <Kurzwort>“, jetzt auch mit Umlauten), `/api/delegation` (Kurznamen + Team-Zeilen im Prompt, MAKE.One nur an Malins Konto), `/api/inbox/triage`, `/api/loop` (Operations), Brain → ZOE (`blockZiele`). Server über `teamVon`/`teamFuerPerson`/`teamFuerAnfrage` (`lib/make-one/team-speicher.ts`), Browser über `hooks/useTeam.ts`. `lib/make-one/team-data.ts` ist nur noch Rückfall für leere Speicher und Tests.
- Tests: `tests/team-daten.test.ts`.

### Prüfliste U4 (vor dem Hochladen durchklicken)
- [ ] Säule Familie & Partnerschaft: Karte „Team“ zeigt Kevin und Malin (Konto) und den Hinweis „Team einmal eintragen“.
- [ ] Team einmal eintragen (Name, Kurzwort, Rolle) — danach verschwinden die Platzhalter.
- [ ] Aufgaben › „Abgeben“: die Liste zeigt die eingetragenen Namen; Delegieren schreibt „— Delegiert an <Kurzwort> (…)“, der Chip zeigt es.
- [ ] Als Malin eine Person ändern, als Kevin im alten Fenster dieselbe ändern → Hinweis „inzwischen geändert“, Stand neu geladen.

## Aufgeräumt: keine echten Namen im Code (28.09.2026, U3, nur lokal)

- **Namen Dritter raus aus Prompts, Kommentaren, Beispielen und Tests:** Inbox-Triage, Operations-Loop und ZOE nennen das Team jetzt aus `lib/make-one/team-data.ts` (dort nur noch Rollen-Platzhalter außer Kevin und Malin), Kunden als Kategorie. Beispieltermine (KEMARIS-Kalender, Alt-Dashboard), Onboarding-Hinweise, Kalender-Schnelleingabe, Finanzplan-Beschriftungen („Partnerdarlehen“, „Ankermandat“), Konto-Hinweise („Geschäftskonten“) und Testdaten neutral („Beispiel GmbH“, „Kunde A“, „Anna Beispiel“). Private Details (Gesundheit, Rechtsstreit, Inkasso) aus Beispieldaten entfernt.
- **Bewusst geblieben:** Kevins Rechenkern (`lib/finanzen/rechenkern.ts`) — Feldnamen und zwei Beschriftungen im Zahlungskalender nur mit Kevins Wort; CRM-Dateien und -Tests aus Paket U1 (Ausnahmeliste im Wächter mit Grund).
- **Wächter:** `tests/repo-sauber.test.ts` prüft alle versionierten Code-Dateien auf Namen Dritter (Muster nur als Teilstücke) und E-Mail-Adressen außerhalb von Tests (nur reservierte Domains).
- **Entflechtung hält den Rechnungsschutz ein:** Die Prüfliste (Privates aus den Business-Speichern) löscht gestellte/bezahlte/stornierte Rechnungen nicht mehr — nur „geplant“ darf weg; sonst einer Firma zuordnen, mit Vermerk in der Notiz. Löschversuche → 409. Tests: `tests/pruefliste.test.ts`.

### Prüfliste U3 (vor dem Hochladen durchklicken)
- [ ] Aufgaben › „Abgeben“: die Liste zeigt Rollen (Finanzen, Produkt …) und Malin; Delegieren schreibt „— Delegiert an Finanzen (…)“.
- [ ] Haushalt › Prüfliste: eine private, gestellte Rechnung bietet nur Firma zuordnen / so lassen.
- [ ] Echte Teamnamen gehören künftig in die Daten (nicht in den Code) — Vorschlag: Team aus dem Bestand laden.

## Zugriff & Betrieb (28.09.2026, K1, nur lokal)

- **Kartei nur für den Haushalt des Inhabers (#66/#67):** `/api/state/{kontakte,kunden,prospects,netzwerk,stammdaten,aenderungen}` prüfen jetzt `karteiZugang` (`lib/zugang/haushalt-inhaber.ts`) — ein Konto ohne Haushalt oder aus einem anderen Haushalt bekommt 403. Dienstweg ohne Person (Takt) darf; mit Person nur, wenn die Person zum Inhaber-Haushalt gehört (ZOE/Heads/Arbeiter schicken sie schon mit).
- **Keine echten Daten mehr in Startbeständen:** Finanzplan-SEED nur noch Struktur (kdv/kdc ohne Bank, Produkt-Entwürfe, Agenda) — keine Kunden, kein Kredit, keine Beträge. Kunden und Meilensteine ohne Startbestand. Bestehende Pläne/Listen werden nie angefasst. Wächter in `tests/repo-sauber.test.ts` prüft jeden `SEED`-Block.
- **Änderungsprotokoll serverseitig (#44):** Schreibwege (`listePatchen`, `aendereCrm`, PUT-Wege der Kartei-Routen) hängen selbst an: wer (Person · ZOE für Person · Import · System), Bestand, Kennung (Kontakte nur als Fingerabdruck `c#…`), Feldnamen — nie Werte. Monatsdateien `aenderungsprotokoll--<haushalt>--<JJJJ-MM>`, nie gekürzt. Der Browser-POST ist aus (405), `components/os/Protokollant.tsx` entfernt. Alte Einträge werden weiter angezeigt.
- **Ablehnen statt kürzen:** zu viele Änderungen auf einmal (Kartei 200, CRM-Bestand 200, Kunden 50, Stammdaten 200 je Liste, Netzwerk 2000/500, Ziele/Meilensteine/Routinen je Grenze) → 413 mit Text, nichts gespeichert.
- **ZOE (#98):** Kontext aus dem Browser zählt als Fremdtext — danach nur Vorschläge; `fakt_merken` und `notiz_anlegen` im Gespräch immer über den Stapel.
- **fsync (#37):** Bestände werden vor dem Umbenennen auf die Platte synchronisiert, danach das Verzeichnis.
- **HOI (#39):** roter Befund „Bestand beschädigt beiseitegelegt“, sobald `.corrupt-…` im Datenordner liegt (nur Dateinamen).
- **Sicherung (#109/#110):** Rotationsskript erinnert deutlich, den alten Schlüssel 14/7 Tage aufzubewahren; neues `deploy/sicherung-probe.sh` (Mac) + DEPLOY.md „Probe-Restore quartalsweise“.
- **Regel 5:** Dubletten zusammenführen und DSGVO-Löschen nur mit ausdrücklicher Person (sonst 401); Art.-15-Auskunft ohne Person ohne private Notizen.
- **Prüfbau (#40):** `scripts/daten-verschluesselung.mjs` warnt, wenn auf 3000/3001/3011 eine App läuft.
- Tests: `tests/k1-haushalt.test.ts`, `tests/k1-protokoll.test.ts`, `tests/k1-seed.test.ts`, `tests/k1-betrieb.test.ts`, `tests/repo-sauber.test.ts`.

### Prüfliste K1 (vor dem Hochladen durchklicken)
- [ ] Als Kevin und als Malin: Markttraktion › Kartei lädt, ein Feld ändern speichert (kein 403).
- [ ] Mit dem Testkonto aus dem Test-Haushalt „test“ anmelden: Markttraktion/Kartei zeigt nichts, `/api/state/kontakte` antwortet 403.
- [ ] ZOE: „Wie heißt der Ansprechpartner bei …?“ (outreach/prospect-Lauf) läuft weiter durch.
- [ ] System › Zusammenarbeit „Wer hat was geändert“: nach einer Änderung an einem Kontakt erscheint „Kartei · Kevin“ (bzw. Malin), nach einer ZOE-Änderung „ZOE für Kevin“.
- [ ] ZOE mit geöffneter Kontaktkarte bitten, sich etwas zu merken → landet im Stapel, nicht direkt im Gedächtnis.
- [ ] HOI-Seite: kein roter Befund „Bestand beschädigt“ (auf dem Server vorher `ls /srv/make-os/daten/*.corrupt-*` prüfen).
- [ ] Nach dem Ausrollen einmal `deploy/sicherung-probe.sh` mit dem neuesten Tagesarchiv laufen lassen und in DEPLOY.md eintragen.
- [ ] Beim Ausrollen: offene Tabs neu laden (der alte Protokollant schickt sonst POSTs, die mit 405 abgelehnt werden — harmlos).

## Finanzen & Zeit (28.09.2026, K3, nur lokal)

- **Rechnungen ab „gestellt“ bleiben (#50/#81):** gestellte/bezahlte Rechnungen lassen sich nicht mehr löschen, und Betrag, Nummer, Datum, Netto, USt-Satz nicht mehr ändern (Nachtragen leer → Wert geht) — 409 mit Text; auch kein Zurück (bezahlt → geplant). Stattdessen **stornieren** (Status `storniert` mit Datum und Grund, `PATCH /api/state/finanzplan { aktion: 'storno', rechnungId, grund }`): der Eintrag bleibt, zählt aber weder in der Liquiditätsvorschau noch im Umsatz. War die Rechnung schon bezahlt, kommt zum Zahlungseingang `bu-re-<id>` die Gegenbuchung `bu-st-<id>` (negativ) — nichts verwaist, nichts gelöscht. Finanzplanung: ✕ nur bei „geplant“ mit Rückfrage, sonst „stornieren“ mit Grund; Kontakt › Umsatz: „stornieren“ an der Rechnung. ZOE hält sich an dieselbe Regel.
- **Belege in der Dateiablage (#50/#81):** Einträge mit Rechnungs- oder Mandatsbezug werden nicht gelöscht (409) — „vom Bezug lösen“ statt „Löschen“; der letzte Bezug lässt sich nicht lösen.
- **Beträge auf den Cent + eine USt-Funktion (#79/#80):** Rechnungen, Zahlungen und Buchungen werden nicht mehr auf ganze Euro gerundet (1.190,50 € bleibt 1.190,50 €). `lib/finanzen/ust.ts` (`bruttoAusNetto`, `nettoAusBrutto`, `ustAusBrutto`, kaufmännisch je Rechnung) rechnet Mandat → Rechnung, Liquiplan-Posten aus dem Mandat, USt-Voranmeldung und die Netto-Anzeige der Finanzplanung. Kevins Rechenkern v3 unverändert.
- **Zu zweit am Finanzplan (#107):** Firmen, Rechnungen, Zahlungen, Merkposten und Produkte kommen mit `fassung` je Eintrag; wer mit veraltetem Stand schreibt, bekommt 409 mit dem aktuellen Eintrag, die Seite lädt neu und zeigt den Hinweis. Eigene schnelle Eingaben stoßen nicht aneinander (Stand aus dem letzten Serverstand, Speichern nacheinander). „bezahlt“ bleibt ein Schritt.
- **„Heute“ ist überall der Berliner Tag (#75/#77):** keine UTC-Tage mehr aus `toISOString()` für heute (Buchungen, Journal, Liquiplan, Meetings, Grundlage, Posteingang, Heads, Leads/Deals/Übergaben, Export, Rechnung aus Mandat …); `leads()` verlangt den Tag. Art.-15-Frist „+1 Monat“ kappt am Monatsende (31.01. → 28.02.). Wächter in `tests/repo-sauber.test.ts`.
- Tests: `tests/finanzplan-storno.test.ts`, `tests/ust.test.ts`, `tests/heute-berlin.test.ts`, `tests/crm-dateien-route.test.ts` (Belege), `tests/repo-sauber.test.ts` (Wächter).

### Prüfliste K3 (vor dem Hochladen durchklicken)
- [ ] Finanzplanung: Test-Rechnung anlegen (geplant) → ✕ fragt nach, Löschen geht. Zweite Test-Rechnung auf „gestellt“ klicken → kein ✕ mehr, Betrag gesperrt; Nummer/Datum lassen sich einmal nachtragen, danach nicht mehr ändern.
- [ ] „stornieren“ → ohne Grund gesperrt, mit Grund: Zeile blass, „storniert … · Grund“, Forderungen/„offen“ ohne sie.
- [ ] Test-Rechnung stellen, „bezahlt“ klicken, dann stornieren → unter Buchungen stehen Eingang und Gegenbuchung (Summe 0), Hinweis „Gegenbuchung angelegt“.
- [ ] Kontakt öffnen › Umsatz: an einer gestellten Rechnung „stornieren“ mit Grund; ein Rechnungs-PDF zeigt „vom Bezug lösen“ statt „Löschen“.
- [ ] Betrag mit Cent (z. B. 1190,50) eintragen → bleibt nach Neuladen 1.190,50 €; Mandat „+ Rechnung aus dem Honorar“ mit 1.000,42 netto → 1.190,50 brutto.
- [ ] Zwei Fenster (Kevin + Malin) auf der Finanzplanung: in Fenster 1 den Titel einer geplanten Rechnung ändern, in Fenster 2 danach denselben Eintrag → Hinweis „inzwischen geändert … aktuelle Stand geladen“, Fenster 1 gewinnt.
- [ ] Liquidität und Zahlen › Business: stornierte Test-Rechnung zählt nicht als Eingang.
- [ ] Nach dem Test: Test-Rechnungen stehen als storniert im Bestand (gewollt, nie löschen) — die Test-Buchungen `bu-re-`/`bu-st-` unter Buchungen von Hand entfernen (Regel 4).
- [ ] Beim Ausrollen: offene Finanz-Tabs neu laden (alte Seiten kennen `fassung` nicht).

## Identität & Import (28.09.2026, K2, nur lokal)

- **Wiedererkennen sauber (#11–#14, #115):** alle Normalisierer beginnen mit NFC (macOS/Excel liefern Umlaute zerlegt — „Müller“ aus einer Mac-Datei fand die Kartei-„Müller“ nicht). E-Mail-Schlüssel nur noch getrimmt + klein: „max-muster@“ und „maxmuster@“ sind zwei Postfächer (vorher verschmolzen). Sammeladressen (info@, kontakt@, office@, team@, büro@ …) sind kein Personenschlüssel mehr — dann Name+Firma bzw. HubSpot-ID. „G.m.b.H.“, „GmbH & Co. KG“, „e. V.“ werden erkannt. EINE Telefon-Normalisierung (`normTelefon`, „+49…“) für Import und Dubletten (vorher wurde „0049 30 …“ in den Dubletten zu „049…“).
- **Bestand geschützt:** der Import sucht zuerst unter dem neuen Schlüssel, dann unter der früheren Form (`schluesselAlt`) — nur eindeutig, nicht doppelt vergeben und nur, wenn die Namen sich nicht widersprechen. Kein Bestands-Kontakt geht beim Import mehr verloren, auch wenn zwei denselben Schlüssel tragen.
- **Eine Suche (#105/#106):** `suchNorm` (lib/text/such-norm.ts) für Schnellsuche, Kartei-Filter und Dubletten — „mueller“ findet „Müller“, „strasse“ findet „Straße“. Der Suchzwischenstand gilt nur, solange Kartei und CRM unverändert sind.
- **Import-Vorschau prüft (#21–#23, #10):** meldet verrutschte Zeilen (Spaltenzahl), Excel-Kurzform „1,23E+11“, Postleitzahlen ohne führende Null und unlesbare Daten; „TT.MM.JJJJ“ wird ISO, Unlesbares verworfen.
- **Import rückgängig (#25):** jeder Import ist ein Lauf (Stammdaten › Import & Export › „Import-Läufe · 30 Tage“). Rückgängig nimmt neue Kontakte weg und setzt geänderte zurück — nur, wer seitdem nicht von Hand geändert wurde bzw. (neu) an keinem Deal/Mandat/keiner Kampagne hängt; der Rest wird gemeldet. Firmen, die der Abgleich angelegt hat, bleiben.
- **Herkunft/Art. 14 (#27/#62):** importierte Personen bekommen Herkunft „Recherche / Liste“ (bzw. aus QUELLE: Empfehlung, HubSpot, Veranstaltung) und das Fremddaten-Kennzeichen — die Art.-14-Uhr läuft ab dem Import. Gesetzte Herkunft wird nie überschrieben, von Hand angelegte Personen werden nicht zur „Recherche“.
- **Sperrliste (#60/#64):** wer eine Werbesperre bekommt oder nach Art. 17 gelöscht wird, landet gehasht (SHA-256, keine Klartexte) auf der Sperrliste des Haushalts; ein erneuter Import legt ihn nicht wieder an („n gesperrt übersprungen“). Werbesperre aufheben nur noch mit neuer Einwilligung samt Nachweis im selben Schritt — steht als System-Eintrag im Verlauf, erst dann fällt der Eintrag von der Liste.
- **CSV-Export (#28):** Zellen mit „+“/„-“ am Anfang werden immer entschärft, außer reine Telefonnummern/Zahlen.
- **Server stempelt (#68)** `geaendertAm`, `importiertAm`, `vonHand` — Browser-Werte zählen nicht. **Nie abschneiden:** Aktivitäten (bis 10.000) und Einwilligungen (bis 500) je Kontakt werden nicht mehr gekürzt (vorher 600/30), darüber 413. Aktivität ohne Urheber gilt als „system“, nie „kevin“.
- Tests: `tests/crm-k2-identitaet.test.ts`, `tests/crm-k2-routen.test.ts`.

### Prüfliste K2 (vor dem Hochladen durchklicken)
- [ ] Schnellsuche (⌘K) und Kartei-Suche: „mueller“ findet eine Person „Müller“; „strasse“ findet eine Firma mit „Straße“.
- [ ] Stammdaten › Import & Export: eine Test-CSV mit „1,23E+11“ in HUBSPOT_ID, „1067“ in PLZ und „31.02.2026“ in LETZTER_KONTAKT wählen → Vorschau zeigt „Datei prüfen: …“ mit Zeilen; nichts geschrieben.
- [ ] Beim Ausrollen EINMAL die echte Masterliste nur als **Vorschau** laufen lassen: „neu“ muss ≈ 0 sein (sonst nicht übernehmen — Schlüsseländerung prüfen); „über die frühere Schlüsselform wiedererkannt“ ist erwartbar.
- [ ] Übernehmen → Karte „Import-Läufe“ zeigt den Lauf; einen Test-Lauf mit einer erfundenen Zeile zurücknehmen → Person weg, Meldung „1 Kontakte zurückgesetzt“.
- [ ] Testkontakt: Werbesperre eintragen → „Sperre aufheben“ verlangt Kanal + Nachweis; ohne Nachweis gesperrt; mit Nachweis aufgehoben, Verlauf zeigt „Werbesperre aufgehoben — neue Einwilligung …“.
- [ ] Testkontakt nach Art. 17 löschen, danach eine CSV mit genau dieser Person importieren → Vorschau „1 gesperrt übersprungen“.
- [ ] Export (z. B. Segment) öffnen: Werte mit „-“ oder „+“ am Anfang stehen mit ' davor, Telefonnummern nicht.
- [ ] Nach dem Test: Testkontakte, Test-Läufe und den Test-Eintrag der Sperrliste (`crm-sperrliste--<haushalt>`) entfernen (Regel 4).

## Pipeline & CRM-Bestand ehrlicher (28.09.2026, K4, nur lokal)

- **Deal-Historie wird nie mehr gekürzt (#83):** die Säuberung schnitt still auf die letzten 60 Stufenwechsel (Verweildauer, Umwandlung, Zyklus rechnen daraus). Grenze jetzt 5.000 — darüber 413 mit Text, nichts geschrieben (`HISTORIE_MAX`, lib/crm/speicher.ts).
- **Zu zweit am selben CRM-Eintrag (#35/#42/#107):** jeder Eintrag aller CRM-Listen (Firmen, Deals, Mandate, Follow-ups, Events, Gäste, Kampagnen, Beiträge, Segmente …) kommt mit `stand` (Fingerabdruck) aus `GET /api/crm/bestand`. Der Browser schickt ihn bei jeder Änderung mit; hat inzwischen jemand anders geschrieben → **409** mit dem aktuellen Eintrag, Hinweis „Wurde inzwischen geändert — neu geladen. Bitte noch einmal.“ und frisches Laden. Ohne Stand (ZOE, Heads, altes Fenster) bleibt nur die feldweise Änderung erlaubt; ein ganzer Eintrag über einen bestehenden braucht den Stand (Ausnahme Firmen-Upsert: füllt nur Lücken). Schreibvorgänge der Seite laufen nacheinander — zwei schnelle Änderungen am selben Eintrag stoßen nicht aneinander. Logik `lib/crm/crm-stand.ts`.
- **Firmen und Mandate mit Verweisen werden nicht gelöscht (#49):** Firma mit Personen/Deals/Mandaten/Rechnungen bzw. Mandat mit Rechnungen → 409 mit Anzahlen („daran hängen noch 2 Personen · 1 Mandat · 3 Rechnungen“), die Seite zeigt den Text.
- **Pipeline ehrlicher (#84–#86):** „Entscheidung bis“ nach hinten verschoben zählt der Server mit (`erwartetVerschoben`, erstes Datum in `erwartetUrsprung`); ab zwei Verschiebungen wird die Ampel gelb, die Deal-Akte zeigt „Entscheidung 2× verschoben · ursprünglich …“. Prognose zusätzlich **„gewichtet ohne hängende“** (Board-Kopf, Head of Finance bekommt die Zahl). Stammdaten › Wertelisten › Deal-Stufen zeigt ab 5 entschiedenen Deals „gemessen x % (n)“ mit „übernehmen“. „Letzte Aktivität“ beim Stufenwechsel ist der Berliner Tag.
- **Lead-Score (#93/#95):** „hat geantwortet“ und „angesprochen“ kühlen nach 180 Tagen ab (5 bzw. 3 statt 12 bzw. 8 Punkte, Grund mit Tagen). Sales › Auswertung zeigt „SQL- und Gewinnquote je Temperatur“ (Quoten ab 5 Leads).
- **Doppelklick (#19):** Knöpfe mit einer async Handlung sind bis zu deren Ende gesperrt (`aria-busy`, gedimmt) — nichts wird doppelt angelegt.
- Tests: `tests/crm-k4-pipeline.test.ts`, `tests/crm-k4-bestand-route.test.ts`.

### Prüfliste K4 (vor dem Hochladen durchklicken)
- [ ] Zwei Fenster (Kevin + Malin) auf dieselbe Firma: im ersten „Ort“ ändern, im zweiten danach „Ort“ ändern → Hinweis „Wurde inzwischen geändert — neu geladen“, der Ort aus Fenster 1 steht da.
- [ ] Zwei Fenster, verschiedene Felder derselben Firma → beide Änderungen bleiben.
- [ ] Firma mit Person/Mandat löschen versuchen (über den Server, die Karte bietet es nur leer an) → Text mit Anzahlen, Firma bleibt.
- [ ] Deal: „Entscheidung bis“ zweimal nach hinten → Akte zeigt „2× verschoben · ursprünglich …“, Ampel gelb.
- [ ] Deals › Board: neben „gewichtet“ steht „gewichtet ohne hängende“, sobald ein Deal rot ist.
- [ ] Stammdaten › Wertelisten › Deal-Stufen: „gemessen x % (n)“ erst ab 5 entschiedenen Deals; „übernehmen“ setzt den Wert (Chip „von Hand“).
- [ ] Sales › Auswertung: Karte „SQL- und Gewinnquote je Temperatur“.
- [ ] Knopf mit Speichern (z. B. Newsletter löschen) schnell doppelt klicken → nur eine Handlung.
- [ ] Beim Ausrollen: offene Browser-Tabs neu laden (alte Seiten schicken keinen Stand → ganze Einträge werden mit 409 abgelehnt, bis neu geladen ist).

## Verbindungsprüfung als festes Bauteil (28.09.2026, V1, nur lokal)

- **Kevin:** „Einmal nochmal alle Verbindungen im Hintergrund prüfen … Markttraktion muss bald rangehen.“ Jetzt gibt es EINE Stelle, die weiß, welche Kennung auf welche zeigen darf: `lib/crm/verbindungen.ts` (rein, 52 Prüfungen) — Personen ↔ Firmen, Deals (Personen, Firma, Rollen, Produkt, gewonnen ohne Mandat, zwei offene je Firma), Mandate (Deal, Firma, Personen, Produkt, ohne Rechnung in 60/120 Tagen), Rechnungen (Mandat, Gesellschaft, bezahlt ohne Datum, Betrag ≤ 0), Follow-ups, Events/Teilnahmen, Segmente/Kampagnen/Beiträge/Newsletter/Power Hour/Anträge, Werbesperre in laufender Kampagne oder Einladung, Aufgaben-Einheiten, Fokus-Blöcke, Dateiablage (Verweise, Datei fehlt, Datei ohne Eintrag), Import-Konflikte, doppelte Kennungen, gleiche E-Mail, **Kunde ohne Mandat** (Person/Firma, Hinweis — zählt in BEAN solange als Bestandskunde).
- **Oberfläche:** Stammdaten › Datenqualität, Karte „Verbindungen“ oben: Ampel, Befunde nach Fehler/Warnungen/Hinweisen, Anzahl, bis zu fünf Kennungen als Links (Kontakt, Firma, Deal, Mandat, Rechnung, Event, Kampagne, Segment, Aufgabe). Fehler erscheinen zusätzlich im Überblick unter „Was jetzt zu tun ist“ („n Verbindungsfehler im Bestand“).
- **Reparieren nur mit Vorschau und nur sichere Fälle:** tote Personen-Verweise in Deals/Mandaten/Kampagnen/Beitrags-Quellen/Anträgen entfernen, Rollen toter Personen, Lead → gelöschter Deal, offene Follow-ups ohne Person/Bezug → „abgesagt“ mit Grund, veraltete Import-Konflikte abräumen, fehlende Dateien markieren (`dateiFehlt`). Nie wird ein Datensatz gelöscht; Zeitstempel von Deals/Mandaten/Personen bleiben. Route `app/api/crm/verbindungen` (GET mit ETag, POST `{ ids, vorschau }`), je Speicher eine Sperre.
- **Zusammenfassung „Kontakt öffnen“:** „Letztes echtes Gespräch“ nimmt bei Meetings den Zeitpunkt (`wann`), nicht den Tag des Festhaltens, und nur vergangene; kommende als eigener Satz „Nächstes Meeting am …“.
- **Zahlen lesen:** `node scripts/verbindungen-pruefen.mjs [--alle]` (nur Kennung, Schwere, Anzahl — nie Namen).
- **Beim Ausrollen:** einmal gegen den Server `node scripts/verbindungen-pruefen.mjs --url <App-Adresse> --alle` laufen lassen (Dienstschlüssel aus der Umgebung) und die Zahlen ansehen, bevor jemand „Reparieren“ drückt.
- Tests: `tests/crm-verbindungen.test.ts`, `tests/crm-verbindungen-route.test.ts`, `tests/kontakt-oeffnen.test.ts` (Meeting-Zeitpunkt).

## Finanzplan, Planung, Zwischenspeicher: keine stillen Verluste mehr (28.09.2026, F3, nur lokal)

- **Finanzplan kürzt nie mehr still:** Die Säuberung schnitt Firmen bei 10, Rechnungen bei 200, Zahlungen bei 100, Produkte bei 30 ab — jeder PATCH ging davon aus, ab der 201. Rechnung verschwand der Rest beim nächsten Speichern. Jetzt: Lesen wirft nie etwas weg, Grenzen deutlich höher (Rechnungen/Zahlungen 5.000, Firmen 50, Produkte 200, Merkposten 500, Meeting-Punkte 100) und bei Überschreitung **413 mit Text statt Abschneiden** — auch ZOE (`erfasse_rechnung`/`erfasse_zahlung`) und die Beleg-Übernahme. Mehr als 1.000 Änderungen je Aufruf → 413 (vorher still nur die ersten 100). Logik in `lib/finanzen/finanzplan-bestand.ts`.
- **„Bezahlt“ + Buchung in einem Schritt:** `PATCH /api/state/finanzplan { aktion: 'bezahlt', rechnungId, am }` setzt Status + Datum UND legt die Buchung `bu-re-<id>` in derselben Sperre an (idempotent; ein Wiederholen heilt eine fehlende Buchung; geht die Buchung nicht, bleibt die Rechnung unverändert). Kontakt-Reiter Umsatz und Finanzplanung nutzen ihn — kein zweiter Aufruf mit `.catch(() => {})` mehr.
- **Ziele & Meilensteine zu zweit:** Kein PUT des ganzen Horizonts mehr — je Ziel eine Änderung mit Stand (`PATCH /api/state/ziele { horizont, ops }`), veraltet → 409 mit aktuellem Stand und Hinweis, die Kaskade läuft in derselben Sperre. Meilensteine ebenso (mit Stand, nie mehr Vollschreiben). Der alte PUT mit `ziele` antwortet 409; Fokus per PUT bleibt.
- **Routinen & Wochenblöcke:** Blöcke gehen einzeln (`PATCH { bloecke: ops }`), nur die eigenen der angemeldeten Person (fremde → 403, im Planer nur lesbar); PUT `{ bloecke }` ist zu. PUT `{ routinen }` liest in der Sperre (vorher davor — gleichzeitige Block-Änderungen gingen verloren). Routinen gehen ebenfalls als Einzeländerungen mit Stand.
- **Säulen-Seite:** Status einer Aufgabe = genau eine Einzeländerung (`lib/aufgaben/status.ts`), nie mehr der ganze Aufgaben-Stand per PUT.
- **Anfrage-Bündler:** Schreib-Generation — ein GET, der vor dem letzten Schreiben begann, wird nicht mehr geteilt oder frisch gehalten (vorher sah, wer direkt nach dem Speichern las, noch den alten Stand).
- **Memo:** Ergebnisse gelten unter dem Stand vom Start der Rechnung — schreibt während der Rechnung jemand, rechnet der nächste Aufruf neu.
- Tests: `tests/finanzplan-grenzen.test.ts`, `tests/planung-zwei-schreiber.test.ts`, `tests/routinen-bloecke.test.ts`, `tests/aufgabe-status.test.ts`, `tests/anfrage-buendel.test.ts`, `tests/memo.test.ts`.

## Schreibwege repariert (Prüfbericht 28.09.) (28.09.2026, F1, nur lokal)

- **Felder leeren an Kontakten wirkt wieder:** `kontaktTeil` schickte `{feld: undefined}` — JSON verwarf den Schlüssel, das alte Feld blieb stehen. Jetzt geht „leer“ als `null` hinaus (`leerAlsNull`, components/os/crm/daten.ts), der Server entfernt das Feld vor der Säuberung (`teilAnwenden`, lib/make-one/crm.ts); ein geleertes Stammdaten-Feld zählt als von Hand. Betroffen waren u. a. „✓ erledigt“ am nächsten Schritt, Firma lösen, BEAN „zurück auf automatisch“, Kreis/Anrede/Lebensphase/Besitzer leeren, private Notiz leeren, Art.-14-Kennzeichen beim Herkunftswechsel, „Sperre aufheben“.
- **Neue Firma überschreibt keine bestehende mehr:** „Muster GmbH“ nach „Muster“ hat dieselbe Kennung. Anlegen (Kartei „+ Firma“, „+ Person“, Visitenkarte am Einlass, Firma verknüpfen) prüft vorher (`bestehendeFirma`) und verknüpft; der Server führt einen Upsert mit bestehender Kennung zusammen (nur leere Felder füllen — Lead, Zahlung, BEAN, Notiz, Domain, Branchen, Rolle bleiben).
- **Firmen-Karte** schreibt nur die geänderten Felder (`teil`) — eine gleichzeitige Lead-Qualifizierung geht nicht mehr verloren; Deals und Mandate der Firma per Kennung (`dealZuFirma`/`mandatZuFirma`).
- **„Kein Nachfassen“** am Gast (`nachfassenVerzichtet`) überlebt jedes Speichern.
- **Lead → SQL** behält Antworten je Kernfrage und `qualifiziertAm`.
- **LinkedIn-Profil** (von Hand oder aus dem LinkedIn-Export) gilt als von Hand — der Masterlisten-Import überschreibt es nicht mehr.
- **Geplantes Meeting** (Zeitpunkt in der Zukunft) setzt weder „letzter Kontakt“ noch Stufe/Wiedervorlage; die Kadenz zählt es ab seinem Tag (`letzterKontaktVon`).
- **Mandat aus gewonnenem Deal** hebt eine gesetzte Lifecycle-Phase auf „Kunde“ (Follow Up bleibt; ohne Phase wird nichts gespeichert).
- **Übergabe-Aufgaben** tragen die Einheit aus Deal/Mandat (wie die Heads).
- **Kein Rückfall auf „kevin“:** Planung · Einheiten, Zeit je Einheit und die Kontakt-Frage an ZOE brauchen eine ausdrückliche Person (sonst 401); die Kartei liefert Dienstaufrufen ohne Person keine privaten Notizen und lässt sie beim Zurückschreiben unangetastet.
- Test: `tests/schreibwege-f1.test.ts`.

## Datenschutz vollständig: Art. 15/17 über alle Speicher, Dubletten, Archiv verschlüsselt (28.09.2026, F2, nur lokal)

- **Eine Stelle für den Personenbezug:** `lib/crm/person-bestaende.ts` (`personAufzaehlen`, `personEntfernen`, `personUmbiegen`) kennt alle Speicher mit einer Kontakt-Kennung: Kartei, CRM (über `person-verweise.ts`), Dateiablage je Haushalt (+ Dateien auf der Platte), Import-Konflikte, Freigabe-Listen und Replay-Fälle der drei Heads, kommende Termine (`crm-signale`), Aufgaben. Je Speicher eine Sperre, idempotent.
- **Löschen (Art. 17)** über `/api/crm/datenschutz` und jetzt auch beim Löschen in der Kartei (`op:'delete'` in `/api/state/kontakte`): Dateien nur mit Personenbezug fallen samt Datei weg; hängt ein Dokument zugleich an Firma/Mandat/Deal/Rechnung, fällt nur der Personenbezug (Aufbewahrung). Head-Berichte, die die Person noch im Freitext nennen, fallen ganz weg. Aufgaben: nur eindeutig zugeordnete (Head-Aufgabe zu ihrem Vorschlag oder Link auf sie) werden entpersonalisiert („[gelöscht]“, Link raus) — reine Namenstreffer werden gemeldet (`aufgabenPruefen`), nie geändert. Antwort nennt je Speicher die Zahl der Änderungen.
- **Auskunft (Art. 15)** listet zusätzlich Dateiablage (nur Metadaten), Import-Konflikte, Head-Vorschläge, kommenden Termin und eindeutig zugeordnete Aufgaben.
- **Dubletten:** Verweise in allen Speichern umgebogen; zwei Teilnahmen am selben Event werden eine (jüngste Auskunft gewinnt); private Notiz nur als Paar (Notiz + Verfasser), `netzwerk` vereint, `vonHand` vereinigt, Lead/Zahlung füllen Lücken, Verlauf ohne Doppelte mit den Löschmarken beider. Ein Import-Konflikt einer nicht mehr existierenden Person wird beim Entscheiden entfernt statt 404.
- **Archiv verschlüsselt:** Kopien vor Umzug/Entflechtung/Kategorien-Aufräumen gehen über `lib/store/archiv.ts` — mit Datenschlüssel als Hülle wie die Bestände. `scripts/daten-verschluesselung.mjs` stellt jetzt auch `archiv/` um → **auf dem Server einmal `--verschluesseln` laufen lassen**, damit alte Klartext-Kopien verschlüsselt werden.
- Test: `tests/crm-person-bestaende.test.ts`.

## Flächen für Sales, Marketing, Events · Marke Make.One (Reiter heißt „Make.One“) (27.09.2026, nur lokal)

- **Drei neue Flächen** in der Markttraktion — die Start-Ansicht je Reiter ist jetzt gestaltbar wie Heute und der Überblick (✎ Anpassen oder eine Karte länger drücken; je Person; Standard wird nie gespeichert):
  - **Sales** (`markttraktion-sales`, Pille „Head of Sales“): Head of Sales · Wochen-Scoreboard · Sales-Trichter (jetzt als eigene Karte) · Kanal-Leistung. Power Hour, Kampagnen, Auswertung bleiben feste Ansichten.
  - **Marketing** (`markttraktion-marketing`, Reiter „Übersicht“): Marketing-Strecke · **Anfragen** (neu, kurz: offene zuerst, 30 Tage) · **Segmente** (neu, kurz: mit Live-Zahl) · Wartet auf Freigabe · LinkedIn-Netzwerk · Beiträge je Person · Wirkung · Wen wir ansprechen dürfen · Art. 14 · Woher Chancen kommen · Stimme der Kunden. Der Startassistent und die anderen Reiter sind unverändert.
  - **Events** (`markttraktion-event`): Head of Event · Events (kommend, „+ Event“) · gewähltes Event (breit; am Handy weiter unter der Zeile) · **Nachfassen offen** (neu, über alle Events, mit 48-h-Frist, Klick öffnet das Event im Nachfassen) · **Wirkung** (neu, über alle vergangenen Events: Gäste da, Folgegespräche, beeinflusste Pipeline, Kosten je Gespräch) · Vergangene Events.
  - Standardanordnung als Daten in `lib/crm/flaechen.ts` (`KACHELN`, getestet); Komponenten geben sie als `standard` an `<Flaeche>`.
- **Zwei Katalog-Widgets** (Bereich Business, überall dazulegbar, selbstladend): **Kanal-Leistung** (aus `/api/crm/lead`) und **Nächstes Event · Make.One** (aus `/api/crm/bestand`: Datum, Zusagen, offenes Nachfassen).
- **Behoben:** Flächen mit betitelten festen Karten galten immer als „verändert“ (`istStandard` verglich den Titel gegen leer) — „Zurücksetzen“ stand dauerhaft da und unveränderte Layouts wurden gespeichert. Jetzt zählt der Titel des Standards.
- **Marke Make.One** (Kevin: „unter der Marke laufen die Events“): Kopf des Events-Reiters „Events · Make.One — Unsere Veranstaltungsmarke“; `Event.marke` (optional, Vorgabe Make.One beim Anlegen, als Chip im Formular und im Überblick änderbar, leer = Make.One); alte Events gelten abgeleitet als Make.One (nichts zurückgeschrieben). Nach außen: „Veranstalter: Make.One“ im Kalender-Export (ICS), „Nachfassen nach „Make.One · …““ im Follow-up und im Verlauf der Person, Chip im Kopf des Events. Konstante in `lib/crm/marke.ts` (`MARKE_EVENTS`, `markeVon`, `eventName`; `lib/crm/events.ts` reicht sie durch). Kein Logo, keine Homepage-Änderung.
- Tests: `tests/markttraktion-marke.test.ts`, `tests/markttraktion-flaechen.test.ts`, Ergänzung in `tests/flaeche.test.ts`.
- Offen (Kevins Wort): Logo/Wortmarke Make.One, Absender-Name und -Adresse für Einladungen, eigene Domain/Landing, ob der Kalender-Termin (`kalenderTermin`) die Marke im Titel tragen soll (derzeit nicht — sonst erkennt `terminBekannt` bestehende Termine nicht mehr).

## Lead-Score und Qualifizierungsrunde (27.09.2026)

- **Lead-Score (0–100)** an jedem Lead, in vier sichtbaren Teilen: Fit 30 · Wärme 30 · Qualifizierung 30 · Erreichbarkeit 10. Daraus die Temperatur kalt (< 25) · lau · warm (≥ 50) · heiß (≥ 75). Nie gespeichert, immer abgeleitet — jede Teilzahl hat einen Grund im Klartext (`lib/crm/score.ts`).
- **Reiter „Qualifizierung“** rechts vor Sales: Lead für Lead die sechs Kernfragen (ja/unklar/nein) **plus Freitext je Frage** (was genau der Schmerz ist, wer entscheidet …), Fit, Notiz, Score live. „Geprüft → nächster“ legt den Lead 60 Tage weg, „Später“ überspringt, „Kein Fit“/„Ruht“ mit Grund, „Akte öffnen“, bei SQL-Reife „SQL → Deal anlegen“. Malin sieht ihre Leads zuerst, kann Kevins, „Ohne Besitzer“ und „Alle“ umschalten; **Leads ohne Besitzer übernimmt, wer sie qualifiziert** (Knopf „Übernehmen“). Pfeiltasten ←/→ blättern.
- **Kalte Leads** (Score < 25) stehen nicht mehr in Firmen › Leads (dort nur über den Filter „Kalt“), sondern im Marketing-Segment „Vernetzen · kalte Leads“ (neues Segment-Kriterium „Temperatur“) und in der Vernetzen-Runde — erst vernetzen, dann qualifizieren.
- **Herkunftskanal** je Lead (Empfehlung, Event, Content, Outreach, Inbound, Kampagne, Netzwerk, Bestand) aus der gepflegten Herkunft oder der Quelle der Liste; **Kanal-Leistung** (Leads, warm+, SQL je Kanal) in der Runde, unter Sales › Auswertung und in den Datenblöcken von Head of Sales und Head of Marketing.
- Score-Chip in Firmen › Leads (mit Erklärung beim Überfahren) und im Kopf der Kontaktakte.
- Plan und offene Punkte: `QUALIFIZIERUNG_PLAN.md`.

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
  mit 26 Kennzahlen, je Firma + gesamt, Monatsabschluss, Köpfe; Wachstums-Score und ZOE rechnen damit
  („eine Wahrheit“). Nach dem Update: einmal Köpfe (FTE) und den letzten Monatsabschluss eintragen.
- **Business-Index tiefer verankert:** Streifen auf Zahlen · Markttraktion · Mandate; ZOE beantwortet
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

### Kontakt öffnen · Aufbau & Lifecycle (28.09., nur lokal — Kevin, Paket H1, HubSpot-Vorbild, unser Kopf bleibt)

- **„Kontakt öffnen“ statt „Akte öffnen“** — überall (Karteikarte, Follow-up, Qualifizierungsrunde, Hinweise). Alte Links (`a=akte`, alte Reiter) funktionieren weiter. Die Deal-Akte heißt weiter Deal-Akte.
- **Drei Spalten unter dem Kopf** (am Handy untereinander): **links** Kontaktdaten (E-Mail mit Kopieren und Mail-Programm, Telefon, LinkedIn), **Schnellaktionen** als runde Knöpfe — Notiz · E-Mail · Anruf · Aufgabe · Meeting — und die **wichtigsten Infos** als Chips (Lifecycle, Typ, Kategorie, Besitzer, Kreis); **Mitte** die Reiter **Über · Aktivitäten · Umsatz · Daten**; **rechts** Firma · Deals · Mandate · Follow-ups, je einklappbar, mit „+ Hinzufügen“ (Firma verknüpfen oder anlegen, Deal anlegen, Aufgabe).
- **MAKE OS verschickt nichts:** E-Mail = ZOE-Entwurf + Mail-Programm öffnen; Anruf = Telefon-Link + „Anruf festhalten“ mit Ergebnis; Meeting = Termin festhalten (keine Einladung, keine Teilnehmer). Kanäle nur, wo die Ampel nicht rot ist; bei Werbesperre sind E-Mail und Anruf aus.
- **Über:** eine **Zusammenfassung** in zwei bis vier Sätzen aus den echten Daten (letztes Gespräch, jüngste Mail/Antwort, offener Deal und Mandat, nächster Schritt, Lifecycle) — jede Aussage mit Quellen-Nummer ①②…, ein Klick springt in die Aktivitäten zur Quelle, zum Deal oder zum Mandat. Darunter **„Frage stellen“** an ZOE (nur mit den Daten dieser Person, nie die private Notiz, nie gesperrte Personen) und **„Mit ZOE formulieren“**, wenn KI verfügbar ist — ohne Guthaben ein freundlicher Hinweis. Dazu nächster Schritt, Lead-Qualifizierung kurz (Score, sechs Kernfragen als Punkte), Beziehung kurz, die letzten drei Aktivitäten.
- **Daten:** Stammdaten (Matrix), Notiz, Beziehung, Netzwerk, Verbindungen, Datenschutz, Anträge, Privat — alles einklappbar.
- **Lifecycle:** Lead · Marketing Qualified Lead · Sales Qualified Lead · Opportunity · Angebot · Kunde · Follow Up — als Chip im Kopf mit **Vorschlag aus den Daten** (aktives Mandat → Kunde; beendetes Mandat/gewonnener Deal → Follow Up; Deal in Angebot/Abschluss → Angebot; offener Deal → Opportunity; Lead SQL → SQL; Antwort, Anfrage, Event-Teilnahme oder warmer Score → MQL; sonst Lead), ein Klick übernimmt. Der Masterlisten-Import belegt die Phase aus der Spalte LIFECYCLE nur vor, solange sie leer ist — er überschreibt sie nie. In der Kartei als Spalte und Filter, im Export (`LIFECYCLE_PHASE`, `LIFECYCLE_GESETZT`), als Segment-Kriterium und im Datenblock von Head of Sales/Marketing (je Lead und Verteilung).
- Technik: `components/os/crm/Akte.tsx`, `KontaktSpalten.tsx`, `KontaktUeber.tsx`, `kontakt-klappe.tsx`; `lib/crm/lifecycle.ts`, `lib/crm/zusammenfassung.ts`, `lifecycleVorschlag`/`lifecycleVon` in `lib/crm/vorschlaege.ts`, Route `app/api/crm/kontakt-frage`. Tests `tests/kontakt-oeffnen.test.ts`.

### Kontakt öffnen · Reiter „Umsatz“ (28.09., nur lokal — Kevin, Paket H2, HubSpot-Vorbild „Vom Angebot bis zum Zahlungseingang“)

- **Sechs Kacheln, je einklappbar:** **Umsatz mit dem Kunden** (bezahlt, offen, überfällig, Monatswert der aktiven Mandate, gewonnene Deals, Balken je Jahr, Aufteilung je Einheit Selbstständigkeit · KD Ventures · MAKE OS UG) · **Zahlungsmöglichkeiten** · **Verträge** · **Angebote** · **Rechnungen** · **Zahlungseingang**.
- **Was gehört dazu?** Mandate und Deals, in denen die Person steht, und die ihrer Firma; Rechnungen aus dem Finanzplan über das Mandat — ohne Mandat-Bezug über den Kundennamen, dann mit Hinweis **„per Name zugeordnet“**. Private Posten zählen nie.
- **Zahlungsmöglichkeiten** (an der Firma, bei Personen ohne Firma an der Person): Zahlungsweg (Überweisung · SEPA-Lastschrift · Kreditkarte/PayPal-Link · Bar) als Chip, Zahlungsziel, Rechnungsempfänger (Name, E-Mail, Anschrift), USt-IdNr., Bestellnummer/Referenz, bei SEPA Mandatsreferenz und -datum. **Die IBAN steht nur maskiert da** (`DE89 •••• •••• 3000`), wird nur mit gültiger Prüfziffer gespeichert und geht in keinen Export und an keinen Agenten. „Fehlt noch: …“ zeigt, was für eine saubere Rechnung fehlt.
- **Verträge:** hochladen (PDF, DOCX, Bild · bis 15 MB) mit Titel, Art (Rahmenvertrag · Auftrag · NDA · AV-Vertrag), gültig von/bis, Kündigungsfrist, Bezug zu Mandat oder Deal; herunterladen, löschen mit Rückfrage; „endet in …“ 60 Tage vorher.
- **Angebote:** aus Rechnungs-Vorgängen mit Angebotsnummer, aus Deals in der Stufe Angebot/Abschluss (gewonnen = angenommen, verloren = abgelehnt) und eigene über **„+ Angebot“** (Nummer, Datum, Betrag, Bezug, PDF optional) mit Status offen · angenommen · abgelehnt; angenommen → **„als Rechnung planen“** legt eine geplante Rechnung im Finanzplan an.
- **Rechnungen:** Nummer, Datum, Betrag, fällig, Status (überfällig rot), **PDF anhängen**, Sprung „Finanzen ›“; **„+ Rechnung“** geht in den Finanzplan (mit Mandat, Einheit, Fälligkeit aus dem Zahlungsziel).
- **Zahlungseingang:** offene Rechnungen mit **„als bezahlt markieren“** (Datum wählbar; lädt vorher frisch, legt die Buchung wie in den Finanzen an), eingegangene mit Verzug in Tagen und Schnitt.
- **Dateiablage, sicher:** Inhalt verschlüsselt (AES-256-GCM, derselbe Datenschlüssel wie die Bestände) je Haushalt, Metadaten im verschlüsselten Bestand, nur PDF/PNG/JPG/DOCX (am Inhalt geprüft), Download nur als Anhang, nur Kevin & Malin (Haushalt des Inhabers). Dateien gehen nie an ZOE oder Agenten. Beim Schlüssel-Rotieren stellt `scripts/daten-verschluesselung.mjs` die Dateien mit um.
- Technik: `lib/crm/umsatz.ts`, `lib/crm/zahlung.ts`, `lib/dateien/{regeln,ablage}.ts`, `app/api/crm/dateien`, Feld `zahlung` an Firma/Kontakt. Tests `tests/crm-umsatz.test.ts`, `tests/crm-dateien-route.test.ts`.

### Kontakt öffnen · Reiter „Aktivitäten“ (28.09., nur lokal — Kevin, Paket H3, HubSpot-Vorbild)

- **Unter-Reiter** Alle Aktivitäten · Notizen · E-Mails & Nachrichten · Anrufe · Aufgaben · Meetings — je mit Zähler, in der Adresse (`u=`). Zuordnung: Notizen = Notiz; E-Mails = Mail, Antwort, LinkedIn; Anrufe = Anruf; Meetings = Termin, Gespräch, Event + der nächste Termin aus dem Geschäftskalender; **Aufgaben = die Follow-ups der Person** (offen, erledigt, abgesagt — inkl. nächster Schritt, Wiedervorlage, Deal-Schritt, Nachfassen, Review, Kadenz). Systemereignisse (Stufe, System, Übergabe) nur unter „Alle“ und erst mit „Systemereignisse zeigen“.
- **Suchen und filtern:** „In Aktivitäten suchen“ (Text, Notizvorlage, Ergebnis, Ort — Umlaute egal), Chips **Aktivität (x/5)** (mehrfach, unter „Alle“), **Zeitraum** (Seit Beginn · 7 · 30 · 90 Tage · dieses Jahr, Berliner Zeit), **Person** (Kevin · Malin · Beide), „Filter zurücksetzen“, „Alle einklappen/ausklappen“.
- **Oben „Kommend“** (kommende Meetings und Kalendertermine, offene Follow-ups — Überfälliges rot), darunter **je Monat**, neueste zuerst; Monate einzeln einklappbar. Jede Karte: Symbol je Art, Titel („Anruf · Gespräch geführt“), Person, Datum/Uhrzeit, Text mit „mehr“, Notizvorlage, Ergebnis-/Status-Chip, Bezug (Deal, Mandat, Event, Kampagne) als Sprung.
- **Anlegen je Unter-Reiter:** „+ Notiz“ · „+ E-Mail festhalten“ (gesendet/erhalten/LinkedIn — **nur festhalten, nichts wird verschickt**) · „+ Anruf festhalten“ (Ergebnis-Chip; bei Gespräch/Termin/Rückruf die Notizvorlage mit Pflicht-Schritt und Einwilligung) · „+ Meeting“ (Datum, Uhrzeit, Ort, Notiz — keine Kalendereinladung) · „+ Aufgabe“ (Follow-up mit Datum, Art, Zuständig). Offene Aufgaben: „✓ Erledigt“. **Eigene Notizen** bearbeiten und löschen (mit Rückfrage; hat inzwischen jemand anders geschrieben, wird nichts überschrieben).
- **Sprung aus der Zusammenfassung:** jede Karte hat einen festen Anker (`#akt-…`) — der Reiter stellt Filter und Unter-Reiter passend, scrollt hin und hebt die Karte kurz hervor.
- Technik: `lib/crm/aktivitaeten.ts` (rein), `components/os/crm/kontakt/AktivitaetenReiter.tsx` + `aktivitaeten-teile.tsx`, Schreibwege unverändert (`/api/crm/aktivitaet`, `/api/crm/followup`, `PATCH /api/state/kontakte` teil mit Stand). Tests `tests/crm-aktivitaeten.test.ts`.

### Markttraktion · BEAN, Lifecycle-Regel, Notizen sicher, Meeting-Zeitpunkt, IBAN nur maskiert (28.09., nur lokal — Kevin, Paket H4)

- **BEAN-Kundengruppe** (Kevins Sales-Brain): jede Person und jede Firma ist **B** Bestandskunde · **E** Ehemalig · **A** Angebotskunde · **N** Neu. Abgeleitet aus den Daten mit Vorrang B > A > E > N — B = aktives Mandat (Person oder Firma); A = Deal in Angebot/Abschluss, Mandat im Angebot/in Verhandlung oder ein offenes Angebot in der Umsatz-Ablage; E = beendetes oder pausiertes Mandat, gewonnener Deal ohne aktives Mandat, Ex-Kunde; N = alle anderen (die Leads zum Qualifizieren). **Von Hand überschreibbar** (an der Person, an der Firma — gilt dann für ihre Personen); der Import rührt die Wahl nie an.
- **Wo:** Kopf von „Kontakt öffnen“ als Chip neben dem Lifecycle (gestrichelt = automatisch, mit Grund im Hinweis; „von Hand“ markiert; im Menü „zurück auf automatisch“) · links unter „Wichtigste Infos“ · Firmen-Karte · **Kartei** als Filter und Spalte (Buchstaben-Badge) · **Firmen › Leads** als Filter und Badge · **Qualifizierungsrunde** mit zusätzlicher Pille „Neu“ (der Standard der Runde bleibt) · **Segment-Kriterium** BEAN · **Export** Spalte `BEAN` (Kontakte und Firmen) · **Head of Sales/Marketing** (BEAN je Person und Lead, Verteilung) · **Überblick:** Karte „Kundengruppen · BEAN“ — ein Klick öffnet die Kartei gefiltert.
- **Lifecycle-Regel neu:** ein **offener Deal schlägt ein früheres Mandat** (aktives Mandat → Kunde; Deal in Angebot/Abschluss → Angebot; offener Deal → Opportunity; erst dann beendetes Mandat/gewonnener Deal → Follow Up; SQL; MQL; Lead). **Ohne gesetzte Phase gilt „Lead“** — es wird nichts gespeichert; ein Vorschlag erscheint nur, wenn er höher als Lead ist. Kartei, Export, Segmente und Heads rechnen mit „gesetzt, sonst Lead“; die Export-Spalte `LIFECYCLE_GESETZT` ist leer, wenn nichts gesetzt ist.
- **Eigene Notizen sicher ändern/löschen:** eigene Aktion (nur Notizen, nur die eigenen, mit Stand — hat inzwischen jemand geschrieben, kommt „bitte noch einmal“ statt Überschreiben). Gelöschte oder geänderte Fassungen kommen **nicht zurück**, auch wenn ZOE, ein Import oder ein altes Fenster den Kontakt ohne Stand speichert, und beim Ändern entsteht keine Doppelung.
- **Meeting-Zeitpunkt als Feld:** „+ Meeting“ und die Schnellaktion speichern Datum/Uhrzeit und Ort als eigene Felder, der Text ist nur die Notiz; „Kommend“ und die Sortierung richten sich danach. Ältere Meetings (Datum in der ersten Textzeile) werden weiter richtig gelesen.
- **IBAN nur maskiert:** kein Weg an den Browser trägt die volle IBAN mehr (Kartei, Bestand, jede Kontakt-Antwort). Speichern mit der Maske oder leer = unverändert, nur eine neue gültige IBAN ersetzt, „Löschen“ entfernt ausdrücklich. Ausnahme: die Auskunft nach Art. 15 enthält die IBAN der Person (die der Firma bleibt maskiert).
- Nebenbei behoben: Segmente verloren beim Speichern die Kriterien Temperatur und Lifecycle (der Speicher kannte sie nicht) — jetzt bleiben sie, mit BEAN.
- Technik: `lib/crm/bean.ts`, `lib/crm/aktivitaet-marke.ts`, `components/os/crm/bean-teile.tsx`; `lifecycleVorschlagHoeher`/`lifecycleVon` in `lib/crm/vorschlaege.ts`; `notizAnwenden`/`meetingVon` in `lib/crm/aktivitaeten.ts`; `zahlungMaskiert`/`zahlungZusammenfuehren`/`ibanBehalten` in `lib/crm/zahlung.ts`; Route `POST /api/crm/aktivitaet` (`aktion`), Maskierung in `/api/crm/bestand`, `/api/state/kontakte` (`fuerPerson`). Tests `tests/crm-bean.test.ts`, `tests/crm-h4-rein.test.ts`, `tests/crm-h4-routen.test.ts`, angepasst `tests/kontakt-oeffnen.test.ts`, `tests/crm-aktivitaeten.test.ts`.

### Zeit & Fokus: Fokus-Blöcke einer Aufgabe zuordnen · Zeit je Einheit (27.09. spät, nur lokal — Kevin)

- **Zuordnen beim Fokus:** Läuft der Fokus-Zähler oben im Business, öffnet der kleine Knopf daneben „Fokus zuordnen“: **Aufgabe** (offene Business-Aufgaben, Suche ab acht) übernimmt deren Einheit, sonst **„nur Einheit“** (Selbstständigkeit · KD Ventures · MAKE OS UG · eigene). Beim Beenden wird der Block mit Zuordnung verbucht.
- **Aus der Aufgabe heraus:** im Aufgaben-Detail (Liste und Board) **„▶ Fokus“** — startet den Zähler für diese Aufgabe (oder ordnet den laufenden Block ihr zu).
- **Nachträglich:** Seite **Fokus** → Karte **„Fokus-Blöcke · Business“** (letzte 7 Tage) mit denselben Chips.
- **Auswertung:** Seite Fokus → Karte **„Zeit je Einheit“**: Woche/Monat (blättern), Gesamt oder je Person des Haushalts, Stunden je Einheit mit Anteil und Top-Aufgaben; Widget **„Zeit & Fokus“** mit Einstellung **„nach Einheit“** bzw. Katalog-Eintrag **„Zeit je Einheit“**. Gezählt wird nur bewusste Business-Zeit; die Einheit kommt live aus der Aufgabe.
- **Privat-Blöcke ins Business umbuchen:** Karte „Fokus-Blöcke“ zeigt darunter abgesetzt die eigenen Privat-Blöcke der letzten 7 Tage mit **„ins Business“** (danach Aufgabe/Einheit zuordenbar); Rückweg **„nach Privat“** an jedem Business-Block verwirft Aufgabe und Einheit. Nur eigene Blöcke; Privat-Zeit der anderen Person taucht nirgends auf, Zeit je Einheit zählt nur Business.
- Altbestand bleibt gültig (Blöcke ohne Zuordnung = „ohne Einheit“). Technik: `lib/zeitmessung/einheiten.ts`, `/api/state/zeit/einheiten`, Tests `tests/zeit-einheiten.test.ts`, `tests/zeit-route.test.ts`.

### Markttraktion: Typ, Kategorie und Einheit als Chip mit „+ neu“ · Rollen-Vorschläge auf einen Klick (27.09. spät, nur lokal — Kevin)

- **Typ und Kategorie** in der Kontaktakte (Stammdaten › Einordnung) jetzt als **Wahl-Chip**: sichtbar nur der gesetzte Wert, ein Klick öffnet das Menü mit allen Werten der Werteliste, Suche, „– entfernen“, unten **„+ neu …“** (bei einer Suche ohne gleichnamigen Wert: **„„<Suchtext>“ anlegen“**, Enter legt an und wählt) und im Fuß **„Pflegen ›“** zu Stammdaten › Wertelisten. Angelegt wird über denselben Weg wie bisher (`POST /api/crm/stammdaten`, 2–60 Zeichen, feste Werte bleiben); Fehler stehen im Menü.
- **Branchen** bleiben die scrollbare Mehrfachwahl mit „+ neu“ (gleicher Schreibweg, jetzt gemeinsam in `useWertelisteAnlegen`).
- **Einheit an Aufgaben und Routinen** nutzt jetzt dasselbe Bauteil (`Wahl` mit `onNeu`): Chip in der Farbe der Einheit, Farbpunkte im Menü, „ohne Einheit“, „+ neu …“ (über `/api/planung/einheiten`, 2–40 Zeichen), Vorgabe für neue Aufgaben wie bisher. Damit gibt es nur noch **ein** Auswahl-Bauteil.
- **Deal-Akte „Personen & Rollen“:** oben rechts **„✓ Vorschläge übernehmen (n)“** — erscheint nur, wenn Personen ohne Rolle einen Vorschlag haben; ein Klick setzt alle in **einem** Schreibvorgang, danach „n Rollen gesetzt · Rückgängig“ (nimmt genau die übernommenen Rollen wieder heraus; wer inzwischen von Hand geändert hat, behält das). „Bremst“ wird nie vorgeschlagen, bestehende Rollen nie überschrieben.
- Tests: `tests/crm-wahl.test.ts` (Anlegen-Zeile, Längenprüfung), `tests/crm-vorschlaege.test.ts` (Sammel-Übernahme, Rückgängig).

### Markttraktion: Auswahl smarter — Chip + Menü + Vorschlag (27.09. abends, nur lokal — Kevin, Paket D)

Kevin: „Das Rollen-Thema und das ständige Anklicken muss smarter werden — dass man immer alle sieht, ist nicht gut.“

- **Bauteil `Wahl` / `WahlMehrfach`** (`components/os/crm/Wahl.tsx`): sichtbar nur der gesetzte Wert als Chip `[Entscheider ▾]`; Klick öffnet ein Menü am Chip (bleibt im Fenster, am Handy ein Blatt von unten), aktueller Wert markiert, „– entfernen“, wo das Feld leer sein darf; Suche ab 8 Werten; Tastatur ↑ ↓ Pos1 Ende Enter Esc (Fokus zurück auf den Chip), `role="listbox"`, nur ein Menü gleichzeitig, ruhig bei „weniger Bewegung“. Leeres Feld: `[+ Rolle]` oder `Vorschlag: Nutzer [✓ übernehmen] [andere ▾]` mit Grund.
- **Vorschläge** (`lib/crm/vorschlaege.ts`, nie still gespeichert): Deal-Rolle aus Position/Jobtitel/Seniorität (Geschäftsführung/C-Level/Inhaber/Gründer/Vorstand → Entscheider; Leitung/Head of → Fürsprecher nur bei warmem Draht, sonst Nutzer; „Bremst“ nie), Rollen der Person aus Typ/Kategorie/Firmen-Rolle, Anrede nur wenn eindeutig (Freunde & Familie, eigene Nachrichten).
- **Umgestellt:** Deal-Akte „Personen & Rollen“ (mit Sprung „Vorschlag: <Name>“ beim Hinweis „Noch kein Entscheider“), Kontaktakte Beziehung (Kreis · Anrede · Ansprache in einer Zeile, Rollen, Phase von Hand — kein „ändern ▾“ mehr), Datenschutz, Matrix Prio/Eignung, Deal-Detail (Firma, Art, Wert-Basis, Produkt, Quelle, Bezug, Gesellschaft, Verlustgrund), Mandat (Status, Vertrag, Produkt, Phase, Honorar, USt, Verlängerung, Gesellschaft), Gäste (Weg, Rolle, Fotos), Anlege-Formulare (Kontakt, Deal, Gespräch festhalten) und weitere Formulare (Firma, Follow-up, Kampagne, Events, Marketing, Betroffenenrechte).
- **Gesellschaft heißt überall „MAKE OS UG“** statt „Neue UG“ (Namen aus `lib/einheiten.ts`, gespeichert bleibt `ug`).
- Bleiben Pillen: Filter, Reiter, Deal-Stufenleiste, Lead-Status, Gast-Status, Kernfragen ja/unklar/nein, Gesprächs-Ergebnisse, Zweier-Umschalter.
- Tests: `tests/crm-vorschlaege.test.ts`, `tests/crm-wahl.test.ts`.

### Aufgaben im Business nach Einheit: Selbstständigkeit · KD Ventures · MAKE OS UG (27.09. abends, nur lokal)

Kevin: „Nimm als Label bei den Aufgaben mit, dass wir die Aufgaben im Business immer zwischen Selbstständigkeit, KD Ventures und MAKE OS UG unterscheiden können — überall, wo es möglich und nötig ist.“

- **Feld `Task.einheit`** (optional, nur Business). Der Schreibweg (`/api/state/tasks` PUT/PATCH, `/api/tasks/create`) säubert: Namen über `einheitName` vereinheitlicht („Neue UG“ → „MAKE OS UG“, „kdv“ → „KD Ventures“), 2–40 Zeichen, **Privat verwirft die Einheit** (auch wenn der Ort von Hand auf Privat steht). Wer eine Aufgabe nach Privat schiebt, verliert die Einheit schon im Browser. Logik rein in `lib/aufgaben/einheit.ts`.
- **Aufgaben (Liste und Board):** im Business **Filter-Pillen** Alle · Selbstständigkeit · KD Ventures · MAKE OS UG · (eigene, sobald eine Aufgabe sie trägt) · ohne Einheit, mit Anzahl. Einheit als **Chip mit Menü** an jeder Business-Aufgabe (farbig dezent je Kerneinheit, eigene grau; im Board zusätzlich „+ Einheit“ an offenen Aufgaben ohne Einheit), im Detail als eigene Zeile, auf der Kanban-Karte als Anzeige. **„+ neu“** im Menü legt eine eigene Einheit in der Werteliste des Haushalts an (`/api/planung/einheiten`, dieselbe wie bei Zielen). **Neue Business-Aufgaben** bekommen die zuletzt gefilterte/gewählte Einheit als Vorgabe (sichtbar als Chip neben der Eingabe, Merker im Browser).
- **System-Aufgaben:** Heads (automatisch übernommen und von Hand angenommen) tragen die Einheit, wenn ein Deal/Mandat mit Gesellschaft dahintersteht (Mandat vor Deal vor Produkt; „offen“ → keine). Steuer-Aufgaben: Consulting → Selbstständigkeit, KD Ventures → KD Ventures (ältere werden beim nächsten Abgleich nachgetragen), private ohne.
- **ZOE:** `create_task` hat den optionalen Parameter `einheit` (Kerneinheiten + eigene, in der Beschreibung erklärt); ZOE sieht die Einheit in ihrer Aufgabenliste.
- **Überall sichtbar:** Home-Widget „Aufgaben“ (Einheit in der Zeile; neue Einstellung **„Einheit“**: alle · nur Selbstständigkeit/KD Ventures/MAKE OS UG · Business ohne Einheit), Tages- und Wochenplaner (Kürzel in der Aufgaben-Pille), Horizont-Seiten (fällige Aufgaben), **Schnellsuche findet jetzt auch offene Aufgaben** des aktiven Space (Untertitel: Einheit · fällig).
- **Routinen im Business** tragen optional eine Einheit (Wahl in „Neue Routine“ und an jeder Business-Routine; Widget „Routinen heute“ zeigt sie).
- Tests: `tests/aufgaben-einheit.test.ts` (Säuberung/Vereinheitlichung am Schreibweg mit eigenem Datenordner, Ableitung aus der Gesellschaft, Filter, Vorgabe).
- Bewusst nicht: CRM (Deals/Mandate/Produkte haben `gesellschaft`), Finanzplanung (eigene Einheiten), Zeit & Fokus (die Zeitmessung kennt nur `space:bereich`, keine Aufgabe — Vorschlag unten).
- Offen (Kevins Wort): Soll die Zeitmessung Fokus-Blöcke einer Aufgabe zuordnen, damit „Zeit je Einheit“ auswertbar wird? Sollen Beleg-Aufgaben aus den Haushaltsfinanzen (`beleg-…`, Einheit kdc/kdv am Beleg) die Einheit ebenfalls tragen (liegt in `lib/finanzen/**`)? Sollen Aufgaben ohne Einheit einen Vorschlag aus dem Ort bekommen (Ort „Selbständigkeit“ → Selbstständigkeit)?

### Ziele & Planung: Ziele links, Meilensteine rechts, Kaskade, Routinen (27.09. abends, nur lokal — Malins Rückmeldung, Paket C)

Malin: „Ziele links, Meilensteine rechts, + neu oben, Erledigtes unten, Priorität per Pfeil, Business nach Einheit, Jahresziel kaskadiert, Routinen Privat/Business je Person mit Rhythmus, Home zeigt, was heute dran ist.“

- **Ziele links, Meilensteine rechts** auf jeder Ebene — Tag (`/os/planung`), Woche (`/os/planung/woche`), Monat, Quartal, Jahr: zwei Karten nebeneinander (am Handy untereinander), **„+ neu“ oben** in beiden, offene Einträge nach Priorität, **Erledigtes in einem eigenen Bereich unten** in derselben Karte (vier Zeilen sichtbar, der Rest scrollt, Zähler). Meilensteine eines Horizonts sind die mit Fälligkeit im Zeitraum (Jahr: auch ohne Datum); „+ Meilenstein“ ohne Datum nimmt das Ende des Zeitraums. Ein Bauteil für alle Ebenen: `components/os/planung/ZieleMeilensteine.tsx` + `usePlanung.ts`.
- **Priorität per Pfeil ▲▼** rechts an jeder Zeile — Ziele, Meilensteine, Routinen, Blöcke. Gespeichert als `rang`, Sortierung stabil (ohne Rang hinten), Tastatur: Tab + Enter, Alt+↑/↓ (`components/os/planung/PfeilRang.tsx`, Logik `lib/planung/rang.ts`). Stift ✎ benennt um.
- **Business-Einheiten:** Ziele und Meilensteine im Space Business tragen `einheit`. Werteliste je Haushalt (Speicher `planung-einheiten--<haushalt>`, ohne Haushalt je Person), vorbelegt **Selbstständigkeit · KD Ventures · Kunden**, **„+ neu“** direkt in der Wahl und als Pille. Filter-Pillen oben: Alle Einheiten · je Einheit. Privat kennt keine Einheiten (der Schreibweg wirft sie weg). Route `/api/planung/einheiten` (GET/POST), Logik `lib/planung/einheiten.ts`.
- **Ziel-Kaskade (Kevins Entscheidung):** Ein Jahresziel kann eine **Zahl** (z. B. 120) und/oder einen **Termin** tragen (beides im „+ Ziel“ auf Jahr). Zahlen werden anteilig abgeleitet — 30 im Quartal, 10 im Monat, ≈ 2 je Woche (Rest 16 im Jahr), 0,3 je Tag — als Ziele auf Quartal/Monat/Woche/Tag, markiert „abgeleitet aus Jahresziel“. **Termin-Ziele werden Meilensteine** mit diesem Datum (liegen damit im passenden Quartal), Erledigt am Ziel erledigt den Meilenstein. Ändert sich das Jahresziel, wird neu gerechnet — nie dupliziert (eine Kennung je Elternziel und Ebene). Abgeleitetes lässt sich **lösen** (dann „angepasst“: bleibt, wird nicht mehr nachgezogen, darf gelöscht werden); Umbenennen eines Abgeleiteten setzt ebenfalls „angepasst“. Fällt das Jahresziel weg, verschwindet nicht Angepasstes, Angepasstes wird ein eigenes Ziel. Auf jeder Ebene weiter eigene Ziele. Rechenlogik rein in `lib/planung/kaskade.ts`; läuft im Schreibweg der Ziele (`/api/state/ziele`, jetzt fünf Horizonte `tag · woche · monat · quartal · jahr`, bis 40 je Ebene).
- **Routinen** (`/os/planung/routinen`, Speicher `routinen`, additiv): **Space Privat/Business**, **Owner** je Person oder **gemeinsam** (`beide` — für beide sichtbar und abhakbar, jede Person im eigenen Log), **Rhythmus** täglich · 3×/Woche · wöchentlich · monatlich · quartalsweise · halbjährlich · jährlich mit **„nächstes Mal am“** (Arzt, Steuererklärung; Fälligkeit = Anker oder letzte Erledigung + Rhythmus, Monatsende geklemmt), Reihenfolge per Pfeil, Filter Privat/Business/Alle und je Person. Altbestand bleibt gültig: fehlendes `space` = privat, fehlender Owner = beide, fehlender Rhythmus = täglich (`lib/planung/routinen.ts`, `rhythmus.ts`). **Blöcke:** Wochenvorlage je Person (Mo–So Zeitfenster Privat/Business, Titel, Pfeil, Klick auf B/P wechselt), Schnellstart „Mo–Fr 09–18 Business anlegen“; liegen als `bloecke` im selben Bestand (`PUT { bloecke }`). Gesundheits-Stand (`/api/gesundheit/stand`) zählt nur noch eigene und gemeinsame Routinen.
- **Home zeigt heute fällige Routinen:** Katalog-Widget **„Routinen heute“** (Einstellung Bereich: Privat · Business · beide; im Home-Standard je Space eine Karte) — eigene und gemeinsame Routinen, nach Rhythmus fällig (überfällig markiert, „2/3 diese Woche“), abhakbar in den eigenen `health-log`, `null` wenn nichts dran ist. „Routinen & Streak“ (Gesundheit) bleibt unverändert daneben.
- Typen in `lib/planung/typen.ts` (eine Wahrheit für Ziel, Meilenstein, Routine, Block), Zeiträume in `lib/planung/zeitraum.ts`. Tests: `planung-kaskade` (18), `planung-rhythmus` (10), `planung-rang` (8), `planung-routinen` (12), `planung-einheiten` (7).
- Offen (Kevin/Malin): Standard-Blöcke je Person (welche Zeiten gelten für Kevin, welche für Malin?), ob die Tagesplanung ihre Routinen-Liste ebenfalls nach Person und Fälligkeit filtern soll (heute zeigt sie alle aktiven), Umbenennen/Löschen von Einheiten (bewusst noch nicht — Ziele tragen den Namen als Text), ob Quartals-Zahlenziele ohne Jahresziel selbst weiter kaskadieren sollen.

### Privatfinanzen: Fixkosten bearbeiten, Rhythmus klären, „Bezahlt“ (27.09. abends, nur lokal — Malins Rückmeldung, Paket B)
- **Fixkosten bearbeiten** (Reiter „Fixkosten & Budget“): neue Karte „Eure Fixkosten“ mit allen Posten (Empfänger-Gruppen), je Zeile ✎ →
  Name/Empfänger-Anzeige, Betrag je Zahlung (bei unterschiedlichen Beträgen mit Warnung), Rhythmus, Kategorie, Konto und die Einstufung
  **Fixkosten ↔ Variabel**. Umstufen gilt **nur für diesen Posten** (Kevins Entscheidung); Häkchen „auch künftige Buchungen dieses
  Empfängers“ (Standard aus) passt zusätzlich die Empfänger-Regel an. Rückweg „wieder fix“ über denselben Stift bei den wiederkehrenden
  Zahlungen. Alles als EIN Patch über `PATCH /api/haushalt` mit dem Stand jeder Zeile (409 bei Konflikt), Cent wie im Modell.
- **Budget je Kategorie zählt nur noch variable Ausgaben** (Fixkosten stehen oben) — ein umgestufter Posten erscheint sofort im Budget;
  Ist gegen Soll/Analyse trennen fix/variabel über die eine Einordnung (Ausgaben-Summe bleibt gleich).
- **„Rhythmus unklar“ klären:** Klick auf den Chip (Fixkosten-Posten und wiederkehrende Zahlungen) öffnet die Wahl monatlich ·
  vierteljährlich · halbjährlich · jährlich · unregelmäßig mit Vorschlag aus den Buchungsabständen (`rhythmusVorschlag`, rein,
  getestet). Gespeichert am Posten (`turnus_geklaert` auf den Buchungen + Regel), Chip verschwindet, Sockel rechnet mit dem Rhythmus
  („unregelmäßig“ = Summe der zwölf Monate / 12). Neu im Modell: `Turnus` kennt `halbjahr` und `unregelmaessig`; Abstände, die um mehr
  als zwei Monate streuen (1 · 5 · 1 · 6), gelten nicht mehr als „quartal“, sondern als unklar.
- **Offene Rechnungen „Bezahlt“** (Reiter „Schulden & Rechnungen“): wirkt sofort (optimistisch), Zeile rutscht in den einklappbaren
  Bereich „Bezahlt (n)“, Summe „offen“ zieht mit; „Doch nicht“ öffnet wieder. Fehler stehen **an der Zeile** („Nicht gespeichert: …“,
  mit „Noch einmal“) statt nur als Meldung unten rechts. Ursache-Analyse: Der Schreibweg selbst war korrekt (Route-Test bestätigt);
  eine Antwort ohne JSON (500 aus `updateJson`, Vorbau, abgelaufene Sitzung) wurde als „Keine Verbindung“ verschluckt und die
  Erfolgsmeldung verschwand nach 5 s — jetzt liefern Route und `patchen` bei jedem Fehler JSON mit Text und Status, die Oberfläche zeigt
  ihn an der Zeile. Route-Test `tests/haushalt-bezahlt-route.test.ts` (403 ohne Haushalt, bezahlt/wieder offen, 409, Fehler als JSON,
  Umstufung fix↔variabel über den Patch-Weg).
- Tests: `tests/haushalt-fixkosten-bearbeiten.test.ts` (Rhythmus-Vorschlag, Posten-Monatswert, unklar → geklärt, Umstufung wirkt in
  Einordnung/Summen/Sockel/Ist-Soll, Stand-Prüfung). Sichtprüfung nur im Test-Haushalt mit erfundenen Zahlen.
- **So testet ihr:** Zahlen › Privat › Fixkosten & Budget → bei einem Posten ✎ → „Variabel“ → Speichern: Posten verschwindet oben,
  Budget-Kategorie steigt. Roter Chip „Rhythmus unklar ?“ → Wahl → „So ist es“. Schulden & Rechnungen → „Bezahlt“: Zeile wandert
  sofort nach „Bezahlt (n)“, aufklappen, „Doch nicht“.

### Kontaktakte übersichtlich (Malins Rückmeldung 27.09., nur lokal)

Malin: „Zu viel scrollen — Typ und Kategorie nach oben, Branchen vollständig.“

- **Kompakter Kopf + Reiter** statt Endlos-Stapel: Kopf mit Name, Firma, Phase, Score, **Typ und Kategorie als Chips** (Tipp springt zu Stammdaten), Rollen, Kreis, wer die Beziehung hält, Kanäle und eine Zeile Kennzahlen. Darunter **Überblick · Stammdaten · Beziehung · Verlauf · Datenschutz** — je Reiter zwei Spalten ab Laptop, am Handy eine (Reiter als scrollbare Pillen). Abschnitte einklappbar, Zustand je Person im Browser gemerkt; der zuletzt gewählte Reiter je Person ebenfalls.
- **Adresse:** `?s=kontakte&a=akte&k=<id>&t=<reiter>` — ohne `t` der Überblick; alle alten Links (Schnellsuche, Befunde, ZOE, Telegram) funktionieren unverändert. `kontaktAkte(id, t)` in `lib/crm/adresse.ts`.
- **Überblick** = nächster Schritt, Deals & Mandate, Lead, Beziehung kurz, letzte 5 Aktivitäten, Notiz. **Stammdaten** = die Matrix mit **Typ und Kategorie als Erstes**, dann Person · Firma (Branchen) · Herkunft. **Beziehung** = Kreis/Takt/Rollen/Ansprache, LinkedIn, Verbindungen. **Verlauf** = alles + Entwurf. **Datenschutz** = Grundlage, Einwilligungen, Werbewiderspruch, Betroffenenrechte, Anträge, Privat.
- **Branchen, Typ, Kategorie vollständig:** ein Bauteil `WertelistenWahl` — alle Werte der Werteliste als Pillen in einer scrollbaren Box (~4 Zeilen), Suchfeld ab 12 Werten, Mehrfachwahl (Branchen) bzw. Einzelwahl (Typ, Kategorie). **„+ neu“ direkt in der Akte:** Enter legt den Wert über die Stammdaten-Route an (geprüft, 2–60 Zeichen) und wählt ihn sofort; feste Standardwerte bleiben, Umbenennen/Löschen weiter unter Stammdaten › Wertelisten (Link „Pflegen ›“ daneben). Werte aus dem Import, die in keiner Liste stehen, bleiben als eigene Pille sichtbar.
- Tests: Adresse mit `t` (alte Adressen unverändert), Routen-Test für die Anlage (`tests/crm-stammdaten-route.test.ts`), Wahl-Helfer in `tests/crm-wertelisten.test.ts`.

### Sport: Hyrox, Running, Gym, Erholung (27.09., nur lokal)

Kevin: „Im Gesundheitsbereich einen Sport-Bereich einbauen. Ganz speziell für Malin einen Bereich, der ausgebaut ist mit Hyrox, Running, Gym und Erholung, damit sie ihre Ziele am Anfang schon perfekt planen kann.“

- **Neue Seite `/os/sport`** (Privat › Gesundheit; Kachel „Sport“ auf der Gesundheitsseite, Eintrag in der Schnellsuche). Persönlich je Person
  (Speicher `sport--<person>`, Kevin ohne Suffix) — jede Person sieht nur Eigenes, kein `?fuer=`.
- **Geführter Einstieg** beim ersten Öffnen: Ziel (Hyrox / Lauf / Kraft / Grundlagen) → Zieldatum & Zielzeit → Ausgangswerte → Tage pro Woche mit
  Wochenvorschlag (jeder Tag umstellbar) → fertig. Überall der Hinweis: Vorschläge, keine Trainingsberatung.
- **Ziele & Plan:** Saisonziele mit Datum (Wochen bis dahin), Zielzeit/Zielpace/Kraftziel, Wochenstruktur (Art + Minuten je Tag, Ruhetag), Plan gegen Ist
  über 8 Wochen, Deload-Rhythmus (alle 4 Wochen, gezählt ab Planstart).
- **Hyrox:** die 8 Stationen + 8 × 1 km; Zielzeit-Rechner (Splits nach üblichen Anteilen, Läufe 52 %, Roxzone 6 %), Stationszeiten erfassen (Training /
  Simulation / Wettkampf), Schwächen gegen das Ziel (teuerste Station zuerst), Bestzeit je Station, Prognose aus den Bestzeiten.
- **Running:** Läufe (Datum, Distanz, Zeit, Art, Gefühl, Notiz; Pace automatisch, `quelle` für späteren Import), Wochenkilometer 12 Wochen mit Trend,
  Bestzeiten 5 / 10 / 21,1 km (leicht längere Läufe hochgerechnet, sonst Riegel-Schätzung), Zielpace und Trainingsbereiche aus dem Laufziel.
- **Gym:** Übungsbibliothek (17 Übungen, eigene ergänzbar), Einheiten mit Sätzen (kg × Wdh) aus Vorlage oder frei, e1RM nach Epley je Satz/Übung, Verlauf und
  Rekorde je Übung, Vorlagen (Hyrox Kraft A/B, Stationen-Zirkel, Grundlagen) + eigene („als Vorlage merken“).
- **Erholung:** Schlaf, Ruhepuls, HRV, Gefühl, Muskelkater je Tag (aus den Vitalwerten der Person vorbelegt, wenn vorhanden), Ampel „heute trainieren?“
  aus Erholung + geplanter Belastung (HRV/Puls gegen den eigenen 7-Tage-Schnitt), Verlauf 14 Tage, Ruhetage und Deload.
- Technik: Logik `lib/sport/` (modell · pace · hyrox · gym · plan · ampel, rein), Tests `tests/sport-*.test.ts` (49), Route `/api/sport` (GET mit ETag,
  PUT `{ ops }` in einer Sperre — zu zweit am Handy überschreibt niemand den anderen), Oberfläche `components/os/sport/`.
- Offen (Kevin/Malin): Wettkampfdatum und Zielzeit eintragen; Import Apple Health/Strava später über das Feld `quelle`.

### Masterliste: Online gewinnt (27.09., nur lokal)

Kevin vor dem Upload: Malins Leads sind in die Masterliste eingeflossen; die Liste soll online, ohne dass Malins Pflege in der Kartei verloren geht.

- **Regel „Online gewinnt“:** Der Import füllt nur leere Felder. Weicht die Liste von einem Feld ab, das online von Hand gepflegt wurde, wird nichts überschrieben — das Feld landet in einer Konfliktliste (Feld, online, Liste). Felder, die nur vom Import stammen, frischt die Liste weiter auf. Die Pipeline (Stufe, Verlauf, Besitzer, Kreis, Einwilligungen, Werbesperre) bleibt wie bisher unberührt.
- **Herkunft je Feld:** Jeder Kontakt merkt sich, welche Stammdaten-Felder von Hand gesetzt wurden (`vonHand`, gesetzt beim Speichern aus Kartei/Akte). Bestand ohne diese Liste: konservativ — nach dem Import geändert ⇒ Abweichung ist Konflikt.
- **Ablauf in Stammdaten › Austausch:** Datei wählen → Vorschau (neu / aktualisiert / unverändert / Konflikte / mögliche Dubletten / ohne Besitzer, nichts geschrieben) → Übernehmen. Danach die Konfliktliste zum Durchklicken: „Online behalten“ oder „Liste übernehmen“ je Feld. Offene Konflikte bleiben gespeichert (`crm-import-konflikte`) und kehren mit dem nächsten Import wieder, bis sie entschieden sind.
- **Tolerantes Matching:** Name+Firma ohne Umlaute, Titel (Dr., Prof.), Rechtsformen (GmbH, AG, UG, KG, e.K., & Co.) und Satzzeichen — „Dr. Jörg Müller, Testfirma GmbH & Co. KG“ ist derselbe wie „Joerg Mueller, Testfirma“. E-Mail und HubSpot-ID gehen weiter vor.
- **Mögliche Dubletten (Vorschlag, nie verschmolzen):** gleicher Name bei anderer Firma, gleiche Telefonnummer, und der Listen-Vermerk „Dublette Kevin/Malin“. Stehen nach dem Import unter der Konfliktliste; sichere Paare weiter unter Kontakte › Dubletten.
- **Owner aus der Liste:** „Malin …“ → Malin, „Kevin …“ → Kevin, „… & …“ → beide, „(kein Owner)“/leer/fremd → ohne Besitzer (Kevins Entscheidung: nicht Malin zuweisen). Der Import setzt einen Besitzer nur, wenn online keiner steht, und nie zurück. Hinweis nach dem Import: „N ohne Besitzer — in der Qualifizierungsrunde übernehmen“.
- **Segment „Vernetzen · kalte Leads“** (`seg-vernetzen`) entsteht beim ersten Import im Marketing — kalte Leads gehen dorthin, nicht in Firmen › Leads.
- Tests: `crm-import-online-gewinnt` (19), `crm-import-route` (6). Stand: 125 Dateien · 1031 Tests grün.

### Markttraktion komplett (27.09. nachts, nur lokal)

Kevin: „Marketing noch gar nicht angepasst, Events nicht drin, neben Firmen und Kontakten Deals einpflegen, dann Follow-up-Ebene, dann erst Stammdaten. Deal- und Follow-up-Ebene sauber, das ganze System dahinter sauber aufgesetzt.“

- **Reiter in Kevins Reihenfolge:** Überblick · Kontakte · Firmen · Deals · Follow-up · Marketing · Events · Stammdaten. Der Reiter „Sales“ ist aufgegangen:
  Leads stehen bei den Firmen (Alle Firmen · Leads qualifizieren), die Power Hour im Follow-up, Kampagnen im Marketing. Alle alten Links laufen weiter.
- **Fundament:** Deals und Mandate hängen an der Firma per Kennung (nicht mehr per Name; alte Einträge werden beim Laden nachgezogen).
  Deals entstehen nur noch auf EINEM Weg (Dialog „Neuer Deal“ überall: Pipeline, Karteikarte, Leads, ZOE) — Kernfragen vom Lead, nächster Schritt Pflicht,
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
  - **Ein Deal-Weg wirklich überall:** Leads › SQL, Event „Deal daraus“ (Quelle geht in den Dialog, kein Nach-PATCH), ZOE — alles durch `dealAnlegen`,
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

### Markttraktion umgebaut (27.09. abends, nur lokal)

Kevin: „Überblick, Kontakte, Firmen, Deals und Follow-up in einer Leiste; Sales, Marketing, Events und Stammdaten rechts. Idee oben raus, Suche breiter. Branchen mehrfach wählbar, Lead-Label und Kategorie vorsortiert, Aufhänger frei. Phasen kleiner, aufklappbar.“
- **Leiste in zwei Gruppen:** links die Arbeit (Überblick · Kontakte · Firmen · Deals · Follow-up), rechts die Welten mit Punkt (Sales · Marketing · Events) und Stammdaten. **Sales-Reiter** = Head of Sales + Wochen-Scoreboard + Trichter · Power Hour · Kampagnen · Auswertung. Alte Adressen (`s=sales&a=heute`, `heute`, `kampagnen`) führen dorthin (`lib/crm/adresse.ts`).
- **Kopf:** „Idee“-Knopf entfernt (Bauplan bleibt über die Seite erreichbar), Suchfeld breiter.
- **Akte:** Branchen als Mehrfach-Pillen am Firmeneintrag (`Firma.branchen`, `branche` bleibt der Anzeigetext), Lead-Typ und Kategorie als Pillen aus vorbelegten Listen (`lib/crm/wertelisten.ts`: BRANCHEN_/TYPEN_/KATEGORIEN_STANDARD, eigene unter Stammdaten › Wertelisten), Aufhänger frei. **Phase abgeleitet** (`lib/crm/phase.ts`): Kunde = aktives Mandat, Opportunity = offener Deal, Ex-Kunde = beendet, Interessent = aktiver Lead; von Hand nur Partner/Multiplikator. Beziehung kompakt: Rollen, Ansprache, Anrede als kleine Chips, „ändern“ klappt auf.
- Tests: `crm-phase`; Adress-Erwartungen angepasst.

### ZOE statt Jarvis (27.09., nur lokal)

Kevin: „ZOE, immer groß geschrieben — komplett umbenennen.“ 266 Dateien, 1.100 Stellen, 35 Pfade: `lib/zoe`, `app/zoe`, `app/api/zoe/*`, `components/os/Zoe*`, Bestände `zoe-*`.
- Sichtbar überall **ZOE**; Code-Bezeichner `zoe`/`Zoe…` (ZoePanel, zoe-fenster).
- **Daten bleiben:** `zoe-*`-Bestände übernehmen beim ersten Lesen die alten `jarvis-*.json` (lib/store/local-db.ts, einmalige Umbenennung auf der Platte) — keine Migration auf dem Server nötig.
- **Alte Adressen laufen weiter:** `/jarvis` → `/zoe`, `/api/jarvis/*` → `/api/zoe/*` (308, Methode und Körper bleiben) — ein noch laufender alter Arbeiter oder Bote landet richtig.
- Offen: Texte, in denen ZOE noch als „er“ steht (Jarvis war männlich), nach und nach glätten.

### Finanzplanung jetzt — nächstes Level: Szenario-Baukasten (27.09. abends, nur lokal)

Kevin: „Finanzplanung jetzt muss komplett aufs nächste Level, so können wir damit noch nichts machen und auch nichts planen.“ Und: „… nochmal über die
Produktseite gehen, damit wir das Ganze einmal sauber haben — clean von vorne bis hinten.“

- **Szenarien selbst bauen** (Planen › Szenarien bauen): ein Szenario = Basis (Zeilen, Fixkosten, Treiber) + **Umsatzbausteine** (Produkt × Kunde/Segment ×
  Preis × Menge × monatlich/jährlich/einmalig × Start × Laufzeit × Zahlungsziel, Einheit UG · Privat · KD Ventures) + **Kostenbausteine** (Stelle mit
  Arbeitgeberanteil · Software · Miete · Rate) + **eigene Annahmen** (Kevin/Malin brutto, Steuerquote UG, Zahlungsziel, Ausschüttung UG → Privat ab Monat
  mit pauschaler Steuerquote — Vorgabe 26,4 % Kapitalertragsteuer + Soli, je Szenario einstellbar; netto fließt privat an, der Abzug steht in Gesamt).
  Jede Änderung rechnet sofort (Kern), speichert als Operation, ist rückgängig. Szenarien anlegen, umbenennen, duplizieren, löschen, Treiber wechseln.
- **Was wäre wenn:** Regler für Umsatz UG, Kevin/Malin brutto, Fixkosten privat ±, neue Rate privat, Steuerquote — Wirkung beim Ziehen, gespeichert beim
  Loslassen (Regler sind gewöhnliche Bausteine/Annahmen des Szenarios).
- **Wirkung und Vergleich:** rechts je Szenario Frei verfügbar jetzt, Tiefpunkt UG frei, Runway UG/Privat, Privat-Luft, Ziele im Plan/gekippt, Gruppe Dez 28,
  Steuerrücklage — jeweils gegen die Basis; darunter bis zu drei Szenarien nebeneinander (Basis + zwei) mit **★ Arbeitsplan**. Der Arbeitsplan gilt auf
  allen Seiten (Privat, Business, Gesamt, Lage, ZOE-Kennzahlen); ohne Arbeitsplan rechnet der reine Treiber.
- **Einstieg = Lage:** drei Zahlen (frei verfügbar diesen Monat · Runway UG/Privat · Ziele im Plan) und „Was jetzt zu entscheiden ist“ — Punkte aus den
  Zahlen mit Sprung ins Szenario/Feld — plus „Planungsrunde öffnen“.
- **Gesamt** (neu): Privat · Übergänge (Gehalt brutto/netto, Ausschüttung) · UG (Umsatz, Mindestumsatz = laufende Kosten, Gewinn, Steuerrücklage, frei) ·
  KD Ventures · Gesamt je Monat, dazu Mindestumsatz-Deckung und Steuer (Hinweis, keine Steuerberatung).
- **Navigation zusammengestrichen:** Lage · Planen (Szenarien bauen · Treiber & Annahmen) · Privat · Business (UG · KD Ventures · Selbstständigkeit) · Gesamt
  (Gesamt · Entwicklung · Geldfluss) · Buchungen & Check (Buchungen · Budget · Wochen-Check · Zu erledigen · Kalender & Verträge · Schulden) · Ziele & Töpfe
  (Ziele · Töpfe UG) · Protokoll. Alte `?u=`-Adressen lösen weiter auf.
- **Produkte sind die eine Quelle:** je Produkt Basis (Monat · Jahr · einmalig; aus der Einheit abgeleitet, festklickbar), Laufzeit, Aufwandsanteil (Marge),
  „für die Planung fehlt: …“, „in Szenarien: …“ und der Sprung in die Finanzplanung. Im Baukasten kommen Umsatzbausteine per Klick aus dem Katalog,
  aktive Mandate und gewonnene Deals als Ist-Basis; freie Bausteine heißen „ohne Produkt“. Kein Schreibzugriff ins CRM.
- **Technik:** Rechenkern additiv erweitert (optionale Monatsreihen `Zusatz`; ohne rechnet er wie bisher — Test „Kern = Kern“), Schicht
  `lib/finanzen/szenarien.ts` + `lib/finanzen/produkte.ts` (rein, 32 neue Tests), Speicher unter `planszenarien`/`arbeitsplan` im bestehenden Dokument
  (PATCH-Operationen, Rückgängig, 409, Import älterer Dokumente ohne diese Schlüssel), Route `GET /api/finanzplan/vorschlaege` (nur lesen).
  Details und Rechenweg: `FINANZPLANUNG_JETZT.md`.
- **Offen (Kevin):** `lib/crm/speicher.ts::leistung()` muss `preis.basis`, `laufzeitMonate`, `aufwand` durchreichen (Datei war für dieses Paket tabu) —
  bis dahin gehen diese drei Felder beim Speichern auf der Produktseite verloren.

### Finanzplanung jetzt (27.09., nur lokal)

Kevin: „Unsere privaten Finanzen und die Firmenfinanzen in einem Szenario planen. Die Zahlen sind echt. Als ‚Finanzplanung jetzt‘ links unter die Agenten,
die ganze Systematik, in unserem Design, sofort funktional. Malin sieht alles.“ Grundlage ist Kevins Einbaupaket „Modul Finanzen v3“ (Konzept, Rechenkern,
Mock-up als Funktionsvorlage, Startbestand mit echten Zahlen — der kommt per Upload, nie ins Repo). Plan und Stand: `FINANZPLANUNG_JETZT.md`.

- **Neuer Bereich** `/os/finanzplan`, Eintrag „Finanzplanung jetzt“ unter den Agenten. Fünf Bereiche mit Unterseiten: Überblick (Lage · Wochen-Check) ·
  Monat (Budget · Buchungen) · Planen (Privat · MAKE OS UG · Töpfe UG · KD Ventures · Selbstständigkeit · Szenarien · Ziele) · Verpflichtungen (Schulden ·
  Zu erledigen · Kalender & Verträge) · Auswerten (Entwicklung · Geldfluss · Protokoll).
- **Eine Rechnung:** Kevins Rechenkern v3 (`lib/finanzen/rechenkern.ts`) unverändert — lokal gegen die echte Datei geprüft, stimmt in allen fünf Szenarien
  mit dem Mock-up überein. Steuern und Netto sind Näherungen (Hinweis, keine Steuerberatung).
- **Zu zweit ohne „der Letzte gewinnt“:** jede Änderung ist eine kleine Operation mit Stand-Prüfung (`PATCH /api/finanzplan`); bei Konflikt 409 und der Plan
  lädt neu. Protokoll (wer/wann/was/vorher/nachher) und Wer-Strich an jeder überschriebenen Planzelle (Kevin türkis, Malin lila). Rückgängig per Knopf und
  Cmd+Z, Meldung nach jedem Speichern, Fehler bleiben rot stehen, Verbergen verwischt alle Beträge.
- **Excel-Gefühl im Blatt:** Zelle anklicken oder Ziffer tippen, Enter/Tab, Pfeile, Entf setzt zurück, Rechtsklick/Langdruck: fortschreiben (ab hier ·
  12 Monate), zurücksetzen, Notiz. Plan · IST · Abweichung, Jahr-Filter, IST-Historie Jan–Sep in Lila (Klick öffnet die Buchungen dahinter).
- **Monat:** Balken je Topf mit Strich für heute, Prognose Monatsende, Rest je Tag, Monat abschließen mit Übertrag. Buchungen zuordnen, „merken“ = Regel
  für den Empfänger (rückwirkend), „+ Buchung“ für Bargeld.
- **Speicher** `finanzen-plan--<haushalt>` (nur über `haushaltVon`), `GET` mit ETag, `?nur=kennzahlen` für ZOE/Startfläche, Import über die
  Einrichtungskarte (Datei oder leer beginnen; ersetzen nur ausdrücklich).
- Tests: Rechenkern (erfundene Zahlen), Operationen, Routen — 53 grün; tsc und Lint sauber. Sichtprüfung im Dev-Server steht aus.
- **Nach dem Update einmalig:** Startbestand über die Einrichtungskarte hochladen (Kevin), Kontostände eintragen, Stichtag prüfen („auf heute setzen“).

### Tempo (27.09., nur lokal)

Kevin: „Die Software läuft noch extrem langsam.“ Gemessen im Produktionsbau mit den echten Beständen (Mac; Server ×3–5): die einzelnen Antworten sind schnell
(Kontakte 0,2–0,5 s bei 754 KB, fast alles andere unter 50 ms) — langsam macht es die Menge und das Muster. Start 28 Abfragen, Heute 23, Kalender 17, viele doppelt;
Apple-Kalender glich bei jedem Seitenaufruf live mit iCloud ab (1–2 s, zweimal je Seite); der ZOE-Kopf fragte alle 5 s; und der Zwischenspeicher der Indizes war nie
warm, weil Zeit & Fokus im Lesepfad schrieb. Der Live-Server hat **eine CPU und 1,9 GB** (nicht CX22 wie in DEPLOY.md) — dort reiht sich alles hintereinander.
Hinweis für die Einordnung: Port 3001 ist der Entwicklungsmodus (jede Seite wird beim ersten Aufruf übersetzt, Heute >60 s) — Tempo misst man auf dem Prüfbau (3011) oder dem Server.
- **Anfrage-Bündler** (`lib/http/anfrage-buendel.ts`, `components/os/AnfrageBuendel.tsx`, im /os-Rahmen): gleiche GET-Abfragen an /api werden geteilt (laufend immer, fertig 8 s;
  `cache: 'no-store'` nur laufend), jeder schreibende Aufruf leert den Zwischenspeicher. Getestet.
- **Zwischenspeicher der Indizes** (`lib/store/memo.ts`): Zeit & Fokus, Tageslauf, CRM-Signale, Kalender-Stände, Verläufe, Flächen sind Rauschen; ein Ergebnis wird nicht mehr
  verworfen, wenn währenddessen ein anderer Bestand schrieb. `zeitBildFuer` schreibt nicht mehr (Puffer nur im Speicher aufgelegt).
- **iCloud raus aus dem Seitenpfad:** `/api/apple-calendar` und `/api/kalender` liefern den Stand sofort, ein fälliger Abgleich läuft im Hintergrund (nur ganz ohne Stand wird gewartet);
  der Takt hält alle 5 Min. frisch; geparste Termine je Stand und Zeitraum gemerkt.
- **Polling:** ZOE-Kopf 5 s → 30 s (nur sichtbar) · Stapel 3 → 5 s · Anwesenheit ein Aufruf statt zwei, jede Minute · Taktgeber im Browser 15/5 Min. (nur sichtbar) ·
  Aufgaben 45 s · Haushalt jede Minute mit ETag (vorher 1 MB alle 20 s).
- **Middleware:** die Stand-Rückfrage je Konto wird zwischen gleichzeitigen Anfragen geteilt (ein Seitenstart = eine Rückfrage statt ~28).
- **Embeddings** bleiben auf Rechnern mit ≤ 2 CPUs von selbst aus (`MAKE_OS_EMBEDDINGS=an` erzwingt), sonst mit begrenzten Fäden; Brain-Index-Abgleich alle 30 statt 10 Min.
- **Arbeiter:** höchstens 2 Läufe nebeneinander auf 1–2 Kernen, Ruhepause bis 30 s.
- **Offen (Kevin):** Server auf 2 vCPU / 4 GB heben (dann Embeddings an); Objekt-Cache im Lesepfad und dynamisches Laden der CRM-Teilansichten als nächste Stufe.

### Markttraktion, Feinschliff 3 (27.09., nur lokal)

Kevin: „Das Thema Markttraktion kann ja noch nicht fertig sein — schau da nochmal rein.“ Prüfagent: 33 Befunde, fünf schwer. Umgesetzt:
- **Die Follow-up-Ebene führt wirklich:** Power Hour, „Für dich“ und Befunde lesen dieselbe Fälligkeitsliste (`faellige`) — echte Follow-ups liegen oben in der Power Hour,
  „Für dich“ zählt alles Fällige der Person, ein Befund „Follow-ups überfällig“ führt zu Follow-up › Fällig. Pflege-Takt aus den Stammdaten auch in der Power Hour.
- **Virtuelle Einträge wirken:** „+1/+3/+7 Tage“ auf ein Event-Nachfassen legt ein echtes Event-Follow-up an (vorher: Meldung ohne Wirkung); „Auslassen“ setzt
  `nachfassenVerzichtet` — raus aus der Liste, aber NICHT als nachgefasst gezählt (vorher verfälschte es Nachfassen-48-h). Nachfassen im Events-Reiter erledigt offene Event-Follow-ups mit.
- **Deal-Regel auch über Follow-ups:** der nächste Schritt am Deal lässt sich nicht absagen und nicht ohne Nachfolger erledigen (400 mit Satz; im Fenster ist „kein nächster Schritt“ beim Deal weg).
- **Eine Stelle für alle Personen-Verweise** (`lib/crm/person-verweise.ts`): Art.-17-Löschung, Dubletten-Zusammenführung und Art.-15-Auskunft kennen jetzt alle Listen —
  auch Follow-ups, Deal-Rollen, Power-Hour-Karten, Anträge. Test: nach dem Entfernen steht die Kennung nirgends mehr.
- **Eine Win Rate** (DevSpec: 180 Tage, ab 10, grün ≥ 25 / rot < 15) für Bestand, Business-Index, Traktions-Index, Heads und Auswertung; **eine Gesprächs-Zählregel**
  (Termin zählt erst mit Ergebnis, nie System-Einträge) für Team-Zeile, Kennzahlen, Traktions-Index, Scoreboard.
- **Fundament dicht:** Lead → Mandat trägt die Firmen-Kennung und findet die Firma per Kennung; Anfrage prüft und schreibt in EINER Sperre; Head-Wirkungen stehen als
  Aktivität im Verlauf der Person und überschreiben nie einen stehenden Schritt; Übergabe-Aufgaben verlinken das Objekt (Akte, Event, Kampagne unter Marketing); Deal aus
  „Nachgefasst“ trägt die Event-Quelle; Kalender-Marke am Event meldet Fehler statt zu schweigen; lokale Tage statt UTC in Lead/Übergabe/Deal.
- **Tempo im Modul:** Traktions-Route rechnet die Kennzahlen einmal, Marketing-Trichter je Aufruf einmal; ETag für Kampagnen- und Marketing-GET; virtuelle Einträge werden
  in der Schreibsperre nur für den Ausschnitt gerechnet; Kartei-Zählungen gemerkt.
- **Kleinigkeiten:** Ladezustände mit Fehlerpfad und „Noch einmal“ (Kampagnen, Leads, Power Hour, Anfragen); Segment-Kriterium „Rollen“ (Sackgasse) entfernt;
  Kampagnen-Kopf sagt die Wahrheit („Interesse“ = Lead, kein Deal); Team-Feed öffnet die Deal-Akte; Art.-14-Befund führt in die Ansicht.
- Tests: `crm-person-verweise`, `crm-followup-route` (Routen mit eigenem Datenordner), `crm-followup-ebene-fuehrt`; Erwartungen an Win Rate und Gesprächsregel angepasst.
- **Offen:** 18× `window.confirm` durch die Nachfrage im Fenster ersetzen; Routen-Tests für Datenschutz und Anfrage; Art.-15-Auskunft um LinkedIn-Stand (Netzwerk-Bestand) ergänzen; Farbe des Reiters „Firmen“ (Kevin).

### MAKE OS Homepage — zweiter Durchgang (27.09., nur lokal, `homepage/`)

Kevin: „Grundgedanken sehr gut, CI gefällt mir. Logo noch nicht so. Nie echte Namen, Termine oder Kundendaten — du bist hier Marken- und Marketingprofi. UX kann mehr geben.“
- **Nie wieder echte Daten:** alle Namen, Firmen, Termine und Protokolle in den Bildern erfunden; Gesundheitsdetails und Firmennamen der Gründer entfernt; `homepage/pruefen.mjs` prüft `index.html` gegen eine Sperrliste (CRM-/Kalender-/Vault-Namen, Firmen, verbotene Wörter) und bricht ab — vor jedem Stand laufen lassen.
- **Logo F:** zwei Hälften (MA hell, KE türkis) werden in der Fuge ein M; Wortmarke gleich geteilt; App-Icon, hell, einfarbig, Favicon.
- **UX:** App-Rahmen um jedes Produktbild (wie die Software: Fensterkopf, Leiste Home/ZOE/System) · Aurora-Hero mit Fakten · Fortschrittsbalken, Scrollspy, Burger, Nach-oben · Weg eines Vorschlags als animierte Stufen · Start-Widgets · Founder-Initialen · Regler gestapelt auf Handy · Reiter per Pfeiltasten.
- Behoben dabei: Klassen-Kollision `.zoe` (Chat-Blasen wurden zu Rastern), Regler halbdurchsichtig, doppelter Hebel-Text.

### MAKE OS Homepage — erster Durchgang (27.09., nur lokal, `homepage/`)

Kevin: „Homepage für MAKE OS auf dem UX-Design der Software, Logo entwerfen, USP selbst positionieren, Top-1 % als Maßstab, Founder Malin + Kevin = MA-KE, nur einmal testen.“
- Eigenständige statische Seite (`homepage/index.html`, `css/`, `js/`), keine Abhängigkeit zur App, überall hostbar. Preview „make-os-homepage“ (Port 3012).
- **Logo:** Bildmarke aus zwei Strichen (Malin, Kevin), die sich zum M treffen, mit türkisem Kern; Wortmarke MAKE OS mit zwei Strichen unter MA und KE (Kevins CI-Idee, Personenfarben der Software). Vier Entwürfe, A gewählt.
- **CI** direkt aus `lib/make-one/design.ts` (Tokens, Farbe = Zustand, Türkis als einziger Akzent), Schriften der Software selbst gehostet.
- **Positionierung** aus der Software: ein System für beides (Wachstums-Score), ZOE handelt mit Freigabe, eigener Server in Deutschland verschlüsselt, zu zweit gebaut, Markttraktion statt Lautstärke, Head of IT wacht.
- **14 Sektionen** nach Kevins Seiten-Standard und der Top-1 %-Recherche: Hero mit Status-Chip und lebendem Score-Ring (Privat/Business) · Problem als Sticky-Story · Regler „Vom Blindflug zur Klarheit“ · vier Säulen · ZOE mit Stapel · sechs Bereichs-Schirme (Markttraktion, Brain, Kalender, Zahlen, Gesundheit, Head of IT) · Souveränität · Zu zweit · Warum MAKE (MALIN + KEVIN → MAKE animiert, Founder) · Systemzahlen · Für wen + „Was es nicht ist“ · Die Entwicklung (echte Einträge) · Häufige Fragen · So geht es los · Einmal testen (Mail, nichts gespeichert).
- Effekte mit Maß und `prefers-reduced-motion`: Reveal einmalig nur Desktop, Zähler, Ring, Cursor-Licht, ein magnetischer Knopf, Kippen nur an der Score-Karte, Regler als ARIA-Slider.
- Recherche: `homepage/RECHERCHE.md` (95 Quellen), Vault-Sichtung: `homepage/VAULT_BEFUND.md`. Offene Punkte für Kevin in `homepage/PLAN.md` (Operating/Operation, Fotos, Mail-Adresse und Domain, Gründergeschichte).

### Kalender neu (27.09., nur lokal)

Kevin: „Der Kalender ist wirklich noch grausig … guck bei Google Kalender, wie die das aufgebaut haben, und statte unseren mit mehr Funktionen aus — auch zum Befüllen mit Terminen.“

- **Vier Ansichten** (`components/os/kalender/Kalender.tsx`): Tag · Woche · Monat · Agenda, Heute-Knopf, Pfeile, KW im Titel; Mini-Monat, Sicht (Alle/Kevin/Malin/Gemeinsam),
  Kalender einzeln ein- und ausblendbar (Farbe aus iCloud), Ebenen Fristen/Erinnerungen/Aufgaben, Suche über Titel, Ort, Kalender, Notiz.
- **Zeitraster** (`Zeitraster.tsx`): 0–24 Uhr, 15-Minuten-Raster, rote Jetzt-Linie, überlappende Termine nebeneinander (`lib/kalender/layout.ts`), Klick in eine Lücke legt an,
  Anfassen verschiebt (auch auf einen anderen Tag), untere Kante ändert die Dauer — nur, was MAKE OS ändern darf (🔒 Serie/Teilnehmer/fremder Kalender).
- **Termin anlegen** (`NeuerTermin.tsx`): Schnelleingabe wie Google („Mo 10 Uhr Kaffee mit Frank 45min“, „morgen 14-16 Steuerberater @kevin in Berlin“, „3.10. Geburtstag ganztags“,
  „Fr 9 Uhr Power Hour jede Woche“ — `lib/kalender/schnell.ts`, getestet), darunter die Felder; **Serie** (täglich/wöchentlich/monatlich/jährlich, optional bis) als RRULE und
  **Erinnerung** (pünktlich bis 1 Tag) als VALARM — iPhone und Mac melden sie (`lib/kalender/ics.ts`). Kein Versand, keine Teilnehmer.
- **Tastatur:** t heute · ← → blättern · d/w/m/a Ansicht · n neuer Termin.
- **Agent und Einstellungen** in der Leiste: „Woche prüfen“ (Konflikte, Schutz-Blöcke — eintragen über iCloud statt über den Mac), Kalender je Person, Standarddauer, Kalender → Space.
- Die alte Seite (Liste + Agent, `KalenderView.tsx`) ist ersetzt; der Wochenplaner (`/os/planung/woche`, Blöcke, Routinen) bleibt und ist verlinkt.
- Tests: `kalender-schnell` (Parser + Layout), `kalender-serie` (RRULE/VALARM). Lokal ohne iCloud-Zugang zeigt der Kalender den Mac-Stand nur lesend; Anlegen/Ziehen greift auf dem Server.
- **Offen (Kevin):** Termine aus Aufgaben/Follow-ups direkt in den Kalender ziehen (Wochenplaner kann Blöcke, der Kalender noch nicht); Serie nachträglich ändern bleibt in Apple; Einladungen nie.

### Brain-Abteilung (27.09., nur lokal)

Kevin: „wie ein Wikipedia mit allen Infos chatten … alle wichtigen Regeln fürs Brain festlegen … ein Gedächtnis auf dem Hetzner-Server, das die KI selbst ausbaut.“
Recherche mit 70 Quellen in `BRAIN_RECHERCHE.md`; Kevins Entscheidungen (klickbar, 27.09.): Volltext-Index **und** lokale Embeddings · ZOE nur Vorschläge + eigenes Log · Konstitution + Regelregister · nächtliche Konsolidierung.

- **Brain-Index** (`lib/brain/index.ts`): SQLite FTS5 (Node-eigen, kein Zusatzpaket) über **Abschnitte** der Notizen (an Überschriften geschnitten, mit Kontextzeile
  „Notiz › H1 › H2 · tags“, ~2.000 Zeichen, 10 % Überlappung), inkrementell je Notiz-Hash, Wikilinks als Nachbarschaft (1 Hop), Sicht (scope/owner) vor dem Ranking,
  Titel-/Überschriften-Treffer wiegen extra. Alle 10 Minuten vom Takt abgeglichen; die Suche des Vaults (ZOE, Wissen-Seite, Brain-Chat) läuft darüber, Rückfall ist die alte Dateisuche.
  Datei `.data/brain-index.sqlite` — Klartext wie der Vault selbst, außerhalb des Vault-Git-Repos, jederzeit neu baubar.
- **Lokale Embeddings** (`lib/brain/einbettung.ts`): multilingual-e5-small (Transformers.js/ONNX, int8, 384 Dim.), faul geladen, Vektoren im Index, Kosinus im Speicher,
  **hybrid** mit BM25 per Reciprocal Rank Fusion. Gemessen auf dem Mac: Laden 7 s, drei Einbettungen 47 ms, Prozess ~600 MB. Auf dem 2-GB-Server knapp: Ladeschutz
  unter 400 MB frei, Schalter `MAKE_OS_EMBEDDINGS=aus`; der Head of IT zeigt den Hinweis. Modell-Cache außerhalb der Daten (`/srv/make-os/modelle`, `~/.cache/make-os/modelle`).
- **Konstitution + Regelregister** (`lib/brain/regeln.ts`, Wissen › Regeln): `00. Fundament/KONSTITUTION.md` (≤ 250 Zeilen, in jedem ZOE-Gespräch geladen) und Regel-Notizen
  `00. Fundament/Regeln/*.md` mit Frontmatter (Priorität 0–3, gilt_fuer kevin/malin/beide/zoe, Status entwurf/aktiv/abgelöst, Quelle, erstellt/geändert/freigegeben von+am).
  Anlegen, freigeben, ablösen in MAKE OS; nur **aktive** Regeln gehen in den Prompt (ZOE und Brain-Chat), hart zuerst. Versionen über das Git-Repo des Vaults.
- **Brain-Inbox** (`lib/brain/inbox.ts`, Wissen › Inbox): ZOE legt Vorschläge nach `_inbox/zoe/` (neue Notiz, Ergänzung einer Notiz, Regel) mit Begründung, Quelle und
  Vertraulichkeit (gemeinsam · privat-kevin · privat-malin). Annehmen macht Wissen daraus — mit Provenienz (`erstellt_von: zoe`, `freigegeben_von: <Person>`); Ablehnen bewahrt den Grund.
  `_inbox` ist aus der Suche ausgeschlossen: ein Vorschlag ist kein Wissen, bis ihn ein Mensch freigibt.
- **Nächtliche Konsolidierung** (`lib/brain/konsolidierung.ts`, Systemlauf `konsolidierung` ab 21 Uhr): verdichtet neue Gedächtnis-Fakten, das ZOE-Log und heute geänderte
  Protokolle zu höchstens fünf Vorschlägen (Fremdtext als Daten, Widersprüche als eigener Vorschlag). Ohne KI-Guthaben als Regelwerk: die Fakten des Tages als ein Vorschlag. Auf Zuruf per Knopf.
- **Brain-Chat:** zitiert `[[Titel#Abschnitt]]`, kennzeichnet Unbelegtes als „(Vermutung)“, kennt Konstitution und Regeln.
- Von mir gesetzt (Recherche-Empfehlung): Vault-Markdown bleibt die Wahrheit, ein Vault mit Sicht-Filter, Git des Vaults für Versionen, Ton bleibt Du.
- Tests: `brain-chunks`, `brain-index`, `brain-einbettung`, `brain-regeln`, `brain-inbox`, `brain-konsolidierung` (Test-Vaults im Temp-Ordner, nie der echte).
- **Offen (Kevin):** Server-RAM für Embeddings (2 GB reichen kaum neben App und Arbeiter — Upgrade auf 4 GB oder `MAKE_OS_EMBEDDINGS=aus`); Eval-Set mit 40 Fragen aus dem echten
  Vault (`scripts/`, braucht den Vault — kommt als nächster Schritt); Kern-Blöcke (Profil Kevin/Malin, laufende Projekte) als eigene Notizen anlegen, dann lädt ZOE sie immer.

### Datenschicht Stufe 2 — zu zweit sicher (27.09., nur lokal)

Kevin (27.09., klickbar): JSON bleibt, Stufe 2 jetzt; danach Brain, dann Kalender.

- **Stand je Kontakt:** jede Zeile trägt einen Fingerabdruck des gespeicherten Datensatzes. Der Browser schickt ihn mit jeder Änderung zurück — hat inzwischen jemand
  anderes geschrieben (Malin, ZOE, ein Signal), kommt 409 mit dem aktuellen Stand, die Kartei lädt neu und sagt es. Nichts wird mehr still überschrieben.
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
- **ok-Vertrag der Läufe** (`lib/zoe/agenten.ts`): antwortet eine Route mit Fehlerstatus, `ok:false` oder `error`, ist der Lauf ein Fehlschlag — vorher stand so etwas
  bei Verbesserungs-Loop, Delegation, CRM-Tagesliste und Tagesstart als „Erfolg mit 0 Ergebnissen“ in der Warteschlange (und der Takt wartete nicht).
- **Regelwerk statt Ausfall:** Morgen- und Abendlauf liefern ohne KI (kein Schlüssel / Guthaben leer) einen ehrlichen Lagesatz aus den Zahlen (`lib/zoe/regelwerk.ts`) —
  Aufgaben überfällig/heute/kritisch, Termine, überfällige Forderungen, Frühwarnungen — und stapeln nichts. Der Takt zählt das als Erfolg.
- **Head of IT im Takt:** ab 7:45 der Tagesbericht, danach stündlich der Blick auf NEUES Rot (nur mit Boten); Nachricht an den Inhaber per Telegram, Riegel `hoi-meldung`.
  Im Agenten-Katalog steht der HOI als live (Product), ohne KI.
- **Schalter wirken überall:** „Aus“ unter /os/agenten galt nur für ZOE und den Takt — jetzt auch für den direkten Aufruf von Wochenplan, CRM-Entwurf, Head of Finance und den Heads (409).
- **Eine Freigabe-Sicht:** /os/stapel zeigt zusätzlich „Freigaben der Heads“ (Sales, Marketing, Event, Finance) mit Anzahl und Titeln — entschieden wird weiter beim Head.
- **Verbesserungs-Loop mit Riegel:** jeder echte Versuch (auch ein übersprungener: zu wenig Nutzung, kein Schlüssel) wird in `nutzung.letzterLoopVersuch` vermerkt, der Takt wartet danach 24 h —
  bis dahin stand der Loop, sobald er 7 Tage her war, jede Minute neu in der Warteschlange (8 Läufe in 3 Stunden, alle „0 Vorschläge“).
- **Fremd-Regel:** der Prospecting-Agent heißt `prospect` — der Eintrag in `FREMD_AGENTEN` zeigte auf `prospecting` und griff nie.
- Tests: `anthropic-guthaben`, `regelwerk`, `hoi-lage` erweitert. Stand: 103 Dateien · 887 Tests grün, tsc und Lint sauber.
- **Runde 2 — jedes Ergebnis hat einen Platz** (vorher nur Text in der Warteschlange, wenn ZOE oder der Takt den Agenten liefen):
  Wochenplan → jeder Block ein `plan_block`-Vorschlag im Stapel (Freigeben trägt ein) · Meeting → Aufgaben aus dem Protokoll als `create_task`-Vorschläge ·
  Prospecting → Scores wirklich in der Zielliste gespeichert (stand bisher nur im Text) · Content → Ablage „Entwürfe von ZOE“ auf der Content-Seite (Öffnen/Löschen) ·
  Delegation → letzte Runde erscheint unter Aufgaben („Runde von ZOE · Datum“, 7 Tage) · Ernährung → Vorschlag wartet auf der Ernährungs-Seite auf „Übernehmen“ (14 Tage).
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

Alles, was unten in diesem Block steht, ist seit 22:47 online: Tempo, Aufteilung Privat/Business, Spaces zweite Fassung (Home · Heute · Wachstum · Agenten · einklappbare Leiste · Übersicht je Space · Fokus je Space · ZOE kennt den Space), Durchsicht der ganzen Software. Geprüft 22:50: Server auf `59f275e`, App und Arbeiter gesund.

_(hier sammeln, was auf `entwicklung` fertig ist)_

**Spaces, zweite Fassung — nur lokal, noch nicht hochgeladen (26.09. abends, Kevin: „vieles macht noch keinen
Sinn, überarbeite das Ganze hier auf dem Klickdummy“)**
- **Home-Knopf** über den Spaces (Kevin): das eigene Dashboard, frei gestaltbar über „Anpassen“. Startstand: Überblick
  Privat und Business zusammen — Privat-Index | Business-Index, Aufgaben Privat | Aufgaben Business, Finanzen privat |
  Wer heute dran ist, Körper | ZOE & Inbox, Nächste 3 Tage | Fokus, Wachstums-Score.
- **Spaces klappen sofort auf** (Kevin: „muss immer sauber aufgehen“): ein Tipp auf Privat/Business klappt den Kasten
  auf und den anderen zu — ohne wegzuspringen; die Seite wählt man aus den Punkten.
- **Sechs Punkte je Space, symmetrisch:** Privat = Finanzen · Aufgaben · Ziele & Planung · Gesundheit · Familie ·
  Kontakte (neue Seite „Kontakte · privat“ = eure Menschen + wichtige Tage). Business = Finanzen · Aufgaben · Ziele &
  Planung · Markttraktion · Mandate · Agenten. Inbox und Kalender stehen im Kopf oben und folgen dem aktiven Space.
- **Seiten passen zum Space:** Zahlen zeigt im Privat-Space nur Privat + Gesamt, im Business-Space Business, Steuern,
  Gesamt, Head of Finance. Der Planer (Tag/Woche/Monat/Quartal/Jahr/Routinen) nimmt den Space in allen Reitern mit.
- **Farben:** Privat Bernstein, Business Indigo wie in Malins Bild — keine Neonfarben; Leiste nach Malins Aufbau
  (Kästen mit Pfeil, Punkte darunter, unten ZOE · Brain · System · Konto).
- **Heute und Home getrennt** (Kevin: „oben wieder Heute, Heute mit eigenem Bild, Home baut jeder selbst“): oben im
  Kopf steht wieder „Heute“ → feste Tagesseite (Gruß, Datum, Tagesstart/-ende, Fokus heute, Aufgaben beider Spaces,
  Termine, Körper, ZOE, Essen). Home (links oben) ist das frei gestaltbare Dashboard, Startstand = Überblick Privat
  und Business. **Wachstum** steht als eigener Knopf unter Home und führt auf die Gesamtansicht: erst die sechs Säulen,
  danach der Score (Kevin: „das zentrale Stück“).
- **Aufgeräumt (Architektur):** `Kopf.tsx` (vorher WachstumsKopf), `HomeView` (/os) und `HeuteView` (/os/heute) klar getrennt,
  alte Navigation (`lib/make-one/navigation.ts`) entfernt, Adressen in `WEG` (home, heute, uebersicht, menschen), Schnellsuche kennt
  Home/Heute/Wachstum/Übersichten, Idee-Erfassung ordnet neue Seiten richtig zu, ZOE `setze_fokus` je Space; Tests für die Spaces.
- **Leiste einklappbar** (Kevin): das Zeichen oben rechts in der Leiste klappt sie auf eine schmale Symbolspalte zusammen
  (Home, Wachstum, Privat, Business, Agenten, ZOE, Brain, System, Konto als Symbole mit Tooltip); der Stand bleibt gemerkt.
- **Agenten als eigener Knopf** unter den beiden Spaces (Kevin: „das Agenten-Thema einzeln unter Business“) — nicht mehr
  im Business-Untermenü; Business hat damit Übersicht · Finanzen · Aufgaben · Ziele & Planung · Markttraktion · Mandate.
- **Übersicht je Space** (Kevin: „Privat und Business separat aufbauen“): jeder Space hat als ersten Punkt seine
  eigene Übersicht — ein eigenes Dashboard nur mit dem, was zu ihm gehört (Privat: Privat-Index, Fokus, Körper,
  Aufgaben, Finanzen, Termine, Familie, Essen, Routinen, ZOE · Business: Business-Index, Fokus, Traktion, Aufgaben,
  Wer dran, Termine, ZOE, Score). Home bleibt der Überblick über beide.
- **Fokus je Space:** der Fokus-Satz je Horizont gibt es gemeinsam, privat und business (Kompass: Gemeinsam · Privat ·
  Business; Jahres-/Quartals-/Monatsseite im Space schreibt den Space-Satz). Tages- und Wochenplaner zeigen im Space
  den Space-Fokus, sonst den gemeinsamen. Widgets Fokus und Termine lassen sich auf einen Space begrenzen; Termine
  tragen den Space ihres Kalenders.
- **ZOE kennt den aktiven Space:** jede Nachricht trägt Privat/Business mit; ZOE antwortet aus dieser Sicht und
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
beiden hin“)** — Grundregel (Kevins Entscheidung): jeder Eintrag trägt seinen Space; der Space filtert, Heute und ZOE
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
- Noch offen: Kontaktbuch privat (eigene Seite), ZOE kennt den aktiven Space.

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
  Unten gesondert ZOE und Brain, darunter System und Konto. Oben: Suchfeld, das im aktiven Space sucht (⌘K), und
  der Index des Space (Privat-/Business-Index) neben dem Wachstums-Score; die sechs Säulen-Ringe stecken im Bereich
  Wachstum. Der Space merkt sich die letzte Wahl; eine Business-Seite schaltet automatisch um. Handy: Leiste unten
  Heute · Privat · Business · ZOE · System, Privat/Business öffnen ihr Untermenü als Blatt.
  Inbox mit `?space=`: Privat zeigt Apple-Postfächer, Business Microsoft 365 (Trennung nach Adresse folgt).
  Noch offen: Kalender zeigt den anderen Space als „belegt“; eigenes Kontaktbuch für Privat.
- **Wochenplanung je Person** (Kevin: „Malin hat ihre eigene Planung“): der Wochenplaner (Blöcke: Fokus, Reha,
  Routinen, Pausen, eingeplante Aufgaben) liegt jetzt je Person — Kevin behält seinen gewachsenen Plan, Malin bekommt
  ihren eigenen; der Gesundheits-Index und ZOE' Einplanen nehmen den Plan der jeweiligen Person. Den Plan der
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
  ZOE & Inbox, Wer heute dran ist, Familie & Partnerschaft. Widgets zeigen nur, was es für die Person gibt.
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
  Stern = bevorzugt. Ein Tipp → auf die Liste. ZOE nimmt sie zuerst und benennt sie so.
- **Vorrat „was da ist“:** eintragen, was zuhause ist — ZOE plant damit und lässt es auf der Liste weg; „Eingekauft →
  Vorrat“ schiebt Abgehaktes hinein; „→ Liste“ zum Nachkaufen; Rezepte zeigen je Zutat „im Vorrat / auf der Liste / fehlt“.
- **Rezepte an jedem Gericht:** 📖 am Plan-Feld öffnet Zutaten mit Mengen, Zubereitung in Schritten, Dauer, Portionen,
  für wen; „＋“ lässt ZOE das Rezept schreiben; „fehlende auf die Liste“ setzt nur, was nicht da ist.
- **ZOE plant die Woche für alle** (Profile, Grundsätze, bevorzugte Lebensmittel, Vorrat, Hinweis): Plan + Rezepte +
  Liste mit Mengen und Kategorien; „Übernehmen“ ergänzt die Liste (nichts doppelt, nichts aus dem Vorrat).
- **Einkaufsliste wie ein Einkauf:** nach Kategorie (Obst & Gemüse → Frische → Vorrat → Tiefkühl → Getränke →
  Haushalt), Menge, für wen, von wem, Quelle; Eingabe versteht „2x Tomaten“, „500 g Lachs“; **„Warenkorb kopieren“** als
  Text für REWE Lieferservice/Picnic; Lebensmittel-Budget des Monats aus Zahlen → Privat steht dabei.
- **ZOE per Zuruf:** „setz Tomaten und 500 g Lachs auf die Liste“ (`einkauf_setzen`).
- **Unsere Gerichte (Kevin 26.09.: „ein Bereich, wo wir unsere Gerichte abspeichern“):** die Bibliothek unter der
  Essens-Woche — alle Rezepte (von ZOE' Wochen und von Hand), Suche über Name/Zutat/Tag, Tag-Chips, ★ Lieblinge;
  ein Klick öffnet das Rezept mit Notiz („Malin ohne Feta“), „in den Plan“ (Tag + Mahlzeit), „fehlende Zutaten auf die
  Liste“, bearbeiten, löschen (mit Rückfrage). **„+ Gericht“** dreifach: von Hand (Zutaten und Schritte je Zeile —
  „200 g Lachs“, „Olivenöl – 2 EL“), ✨ ZOE schreibt (Name + Wunsch), Rezept einfügen (kopierter Text wird in Form
  gebracht, nichts dazuerfunden). Ein Plan-Feld, das wie ein gespeichertes Gericht heißt, bekommt sein Rezept
  automatisch; leere Plan-Felder bieten „aus euren Gerichten wählen“. ZOE kennt beim Planen eure Gerichte (Lieblinge
  zuerst) und schreibt für sie kein neues Rezept. Direktlink `?s=ernaehrung&g=<id>` (`WEG.gericht`).
- **Gerichte schlanker + Foto (Kevin 26.09.):** Anlegen ist ein Schritt — Name tippen, Enter, ZOE schreibt das
  Rezept; „von Hand“ und „Text einfügen“ nur als kleine Zusatzwege (kann ZOE nicht, geht es mit dem Namen von Hand
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
  jede Sammlung in `.data` (und die Tagessicherungen) als AES-256-GCM-Hülle — ein kopierter Datenordner oder eine
  Sicherung ohne Schlüssel sind wertlos. (Korrektur 29.09.: ein Hetzner-Server-Abbild enthält die `.env` bzw. die
  Schlüssel-Datei MIT — es ist so schutzwürdig wie der Server selbst; Bedrohungsmodell in DATENARCHITEKTUR.md › 4b.)
  Ohne passenden Schlüssel bricht das Lesen laut
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
- **Sicherheit (Audit 26.09., alle kritischen und hohen Funde behoben):** ZOE-Aufträge, Protokoll und
  Freigabe-Stapel sind je Person getrennt (kein Lesen oder Zurücknehmen fremder Schritte); Worker-Endpunkte
  und der Telegram-Eingang nur mit Dienstschlüssel (Vergleich in konstanter Zeit); die Anmeldung leitet nur
  noch auf eigene Pfade weiter; ZOE behandelt gelesene Mails und Recherche als fremden Text — danach werden
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
  Wachstums-Scores IST dieser Index; ZOE kennt `gesundheits_index`; Heute-Karte, Hebel und Meilensteine
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
  Tagesstart, Agenten, ZOE-Werkzeuge) — Kevins Mac-Postfach ist damit wirklich nur für den Inhaber;
  Tageslauf-Bestand ohne Mail-Details; `person:` im Auftragstext gilt nur für den Takt; Whoop-Sync/-Import,
  OAuth (Whoop/M365), Mail-Entwurf, Agenten-Regler, Postfach-Spiegel, Agentenlog nur Inhaber bzw. Dienstweg;
  Business-Zahlen (Finanzen, Finanzplan, Buchungen, Liquiplan, Grundlage, Controlling) nur für den Haushalt
  des Inhabers (Malin ist drin); Privatnotizen bleiben auch in „Heute ansprechen“, Auskunft und Dubletten
  beim Verfasser; Startfläche/Verlauf je Person.
- **ZOE gegen eingeschleuste Anweisungen:** alle Kanäle mit Text Dritter (Kontaktnotizen, Bank-
  Verwendungszwecke, Notizen, Gedächtnis, Agentenläufe, Web, Postfach) sind gekapselt — danach nur noch
  Vorschläge statt Ausführung; Termine, Aufgaben, Deals und Läufe stehen im Prompt als Daten mit Regel.
- **Kostenschutz:** höchstens 40 Modellzüge je Person in 10 Minuten (Takt 120), Body-Grenzen (ZOE 2 MB,
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

## Netzwerken · Schliff für Kunden-Demo (03.10.2026, nur lokal — Branch `netz-schliff`)

Kevin 03.10.: „Wenn man das aufmacht, soll das etwas hermachen — potenzielle Kunden sehen das.“ Nur Darstellung und Ablauf, keine Server-/Datenlogik, keine Funktion entfernt.

- **Handy zuerst (375/390/430 px):** Erfassen mit Schritt-Leiste (Kreise + Linie), Person-Kopf in Schritt 2/3, Schritt-Kacheln mit Symbol, Felder gruppiert (Person · Erreichbar), große Foto-Fläche; die Hauptaktion je Schritt hängt am Handy knapp über der Leiste (`.netz-aktion`, weicht der Tastatur, am Rechner normal am Ende), „Zurück“ daneben leiser. Karte → speichern bei „Nur Kontakt“: **4 Tipps** nach dem Foto (Weiter · Nur Kontakt · Weiter · Speichern). Leere Zustände (Heute, Karten) mit Symbol, Satz und Weg; Ladezustände mit festem Platz; am Rechner `max-width` 640 zentriert.
- **Highlight a — Karte landet in der Kartei:** nach „gesendet“ schrumpft das Kartenfoto (oder ein gezeichneter Platzhalter) in den Chip „Gespeichert · Name · zuständig Person“, darunter „Zum Kontakt ›“.
- **Highlight b — Abend-Zähler** (`components/os/netzwerken/zaehler.tsx`) im Event-Kopf: Kontakte · Termine · Follow-ups zählen sanft hoch (rAF, ≈ 0,75 s), Ring „n von m mit festem Folgeschritt“; gerechnet aus den Teilnahmen des Events (dieselbe Quelle wie der Abendbericht).
- **Highlight c — Visitenkarten-Vollbild:** ruhiger Verlauf aus den Profilfarben (`color-mix`), beim Öffnen ein einmaliger Lichtschimmer hinter dem QR-Feld (Code unberührt, dunkel auf weiß), Wake Lock mit Hinweis „Bildschirm bleibt an“. Kein MAKE-Branding (Test `netzwerken-ansicht` grün).
- **Kontaktakte am Handy:** Schnellleiste mit einheitlichen Symbolen (lucide), weicher Rand als Wisch-Hinweis, Kopf mit Schließen im geöffneten Feld.
- Alles reines CSS/Transition, **„Bewegung reduzieren“ schaltet aus** (Endzustand steht sofort da). Test: `tests/netzwerken-schliff.test.ts`.
