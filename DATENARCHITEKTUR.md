# MAKE OS — Datenarchitektur: Befund und Plan (Stand 26.09.2026, spät)

Kevin (26.09.): „Die ganze Datenarchitektur verbessern, sodass es sehr gut läuft, z. B. das ganze
Kundenmanagement / Markttraktion.“ Entscheidung am selben Abend: **morgen als dringend einplanen**,
die Speicherfrage (JSON oder SQLite) **morgen entscheiden**, die Bereinigung des Datenmodells **später**.

Dieses Dokument ist die Arbeitsgrundlage für den 27.09. Nichts davon ist gebaut.

## 1. Befund in einem Satz

Jeder Bestand ist eine JSON-Datei unter `.data/`, die bei jedem Zugriff ganz gelesen und bei jeder
Änderung ganz neu geschrieben wird. Für das CRM sind das `kontakte.json` (877 KB) und `crm.json` (307 KB).
Das läuft heute, wird aber mit mehr Kontakten und zu zweit zum Engpass — und hat eine echte Datenverlust-Lücke.

## 2. Zahlen

| Messpunkt | Heute |
|---|---|
| `kontakte.json` | 877 KB · 34 Lesestellen · 21 Schreibstellen |
| `crm.json` | 307 KB (25.09. von 30 KB gewachsen, Brain-Übernahme) |
| `grundlage.json` | 1,55 MB, wird bei jeder Business-Index-Berechnung ganz gelesen |
| Öffnen von `/os/markttraktion` | ≈ 5 volle Lesevorgänge der Kartei + bis zu 1 voller Schreibvorgang (`POST /api/crm/signale`) |
| Eine Kontakt-Änderung (`PATCH /api/state/kontakte`) | Datei 3× gelesen, 1× ganz geschrieben; danach laden alle offenen Fenster `kontakte` **und** `bestand` neu |
| Hochrechnung 5.000 Kontakte | 6–8 MB je Klick (formatiert + verschlüsselt + Base64) auf 1 vCPU |
| Sicherung | 1 Kopie je Bestand und Tag unter `.data/backup/`, 14 behalten, gleiche Platte |

## 3. Schwachstellen (Reihenfolge = Dringlichkeit)

1. **Lesefehler wird zu „leer“ → Datenverlust möglich.** `loadJson` (lib/store/local-db.ts:137) gibt bei
   *jedem* Lesefehler `null`; Schreiber wie `crm/signale/route.ts:48` und `crm/aktivitaet/route.ts:43` machen
   daraus `cur ?? { kontakte: [] }` und schreiben das zurück. Schrumpf-Schutz hat nur der CSV-Import
   (`updateGeschuetzt`), `listePatchen` prüft nur Massenlöschungen.
2. **Schreiben ohne Änderung.** `updateJson` schreibt immer. GETs schreiben: `/api/microsoft`, `/api/crm/traktion`,
   `/api/crm/stammdaten`, `/api/apple-calendar`, `/api/kemaris-calendar`, Apple-Routen via `merke()`.
   Folge: ETag springt, alle Fenster laden neu, Zwischenspeicher weg.
3. **Zwischenspeicher praktisch nie warm.** `lib/store/memo.ts` hat *einen* globalen Zähler; `anwesenheit`
   schreibt alle 30 s je offenem Fenster (`components/os/Mitarbeit.tsx:39`), dazu `nutzung`, `aenderungen`.
   `/api/crm/traktion` schreibt selbst und macht seinen eigenen Eintrag ungültig.
4. **Lesen außerhalb der Sperre, dann schreiben.** `crm/import/route.ts:55`, `patch-liste.ts:63`,
   `state/kontakte/route.ts:43`, `crm/lead/route.ts:63/101` (Doppelklick → doppeltes Mandat), Kampagnen, Heads.
5. **Keine Transaktion über mehrere Bestände.** Lead→Mandat, Dubletten zusammenführen, Art.-17-Löschung,
   Kampagnen-Ergebnis: bricht es dazwischen ab, bleibt ein halber Stand.
6. **Zu zweit gewinnt der Letzte.** Kontakte werden als Ganzes gesendet (`kontaktSetzen`), der Server vereint nur
   Verlauf/letzterKontakt/LinkedIn/privatNotiz (lib/make-one/crm.ts:522). Kein 409, kein `teil` für Kontakte.
   Vorbild mit echten Zeilenversionen: `lib/finanzen/haushalt/speicher.ts:152–189`.
7. **Stellen, die quadratisch wachsen:** `firmenDubletten` (lib/crm/firmen.ts:82), `terminSignale` (signale.ts:56,
   *innerhalb* der Sperre), `eventZahlen` (events.ts:45), `dealVon` (leads.ts:87); Kennzahlen je Traktion-Anfrage
   doppelt gerechnet (traktion-index.ts:206); keine dauerhafte Zuordnung Kennung→Kontakt.
8. **Datenmodell verzettelt (später):** Chance/Mandat verweisen per **Firmenname**, 11 Firmenfelder im Kontakt
   kopiert, Lead an Firma *oder* Person, drei Statusmodelle (Kontakt `stufe`, Lead `status`, Chance `stufe` + `lebensphase/
   rollen/typ/kategorie/lifecycle`), Kampagnenergebnisse dreifach, „Kunden“ dreifach (`kundenAusMandaten`,
   `kunden.json`, `Firma.rolle`). Löschen räumt Verweise nicht auf (Art. 17 vergisst `sitzungen.karten`, `head-*`,
   `heads-replay-*` mit vollständigen Datenpaketen, Sicherungen, `archiv/`).
9. **Altbestände parallel:** `netzwerk.json` (190 KB, 731 Kontakte, zweites Modell; noch von `startflaeche`,
   `onboarding-status` gelesen), `kunden.json`, `prospects.json`; `haushalt-*-probe` gleich groß wie echt.
10. **Wachstum ohne Deckel:** `Kontakt.aktivitaeten` (jedes Signal hängt an), `agent-log`-Eintragsgröße,
    `worker.log`/`bau.log` ohne Rotation.
11. **Externe Quellen:** HubSpot ist **nicht** angebunden (nur `hubspotId`, CSV-Import) — passt zur Regel „nur eigene
    Daten“. M365-Stand vom 03.08. ist tot (7-Tage-Grenze). Apple-Mail kommt über `zulieferer.mjs` → `/api/zulieferung`.

## 4. Stufenplan (Aufwand in Stunden, jede Stufe einzeln klickbar und einzeln hochladbar)

| Stufe | Inhalt | Aufwand |
|---|---|---|
| **1 · Absichern & beschleunigen** | Lesefehler nie als leer (Fehler werfen, Schreiber brechen ab); unveränderte Stände nicht schreiben; Lesecache je Bestand im Prozess (ungültig bei Schreibung desselben Bestands); Zwischenspeicher **je Bestand** statt global; Schreibungen aus GET entfernen; `anwesenheit`/`nutzung`/`aenderungen` außerhalb des Stand-Zählers; Dateien ohne Einrückung schreiben | 6–10 h |
| **2 · Zu zweit sicher** | Versionsnummer je Datensatz + 409 (wie Haushalt); `teil`-Änderungen auch für Kontakte; jedes Lesen-Ändern-Schreiben innerhalb der Sperre (Import, Lead, Patch-Prüfungen); Abgleich überträgt nur Änderungen seit Stand statt 877 KB | 10–16 h |
| **3 · SQLite für Kontakte + CRM** (Entscheidung morgen) | Aktivitäten als eigene Tabelle (nur anhängen), Indizes auf Kennung/`firmaId`/Mail/`bezug`, Transaktionen über Kontakt/CRM/Aufgaben; Verschlüsselung im Ruhezustand neu lösen (heute AES-GCM-Hülle je Datei — für SQLite z. B. `better-sqlite3-multiple-ciphers` oder Feldverschlüsselung); Datenübernahme mit Abgleich auf Zeilenzahl | 24–40 h |
| **4 · Datenmodell bereinigen** (später) | `firmaId` statt Name, Firmenfelder raus aus dem Kontakt, ein Statusmodell, Ergebnisse einmal, zentrales Löschen/Umbiegen von Kontakt-Kennungen (auch Art. 17), Altbestände stilllegen | 16–24 h |
| **5 · Kennzahlen & Tests** | Ein Aufbereitungsschritt je Stand für bestand/traktion/stammdaten/lead; Dubletten über Zuordnungstabelle; Signale außerhalb der Sperre; Tests: Gleichzeitigkeit, 5.000 Kontakte, Art.-17-Vollständigkeit | 14–20 h |

Alternative zu Stufe 3, falls JSON bleiben soll: **eine Datei je Kontakt** (kleine Schreibungen, passt zur heutigen
Verschlüsselung, skaliert begrenzt). Beides braucht Stufe 1 und 2 vorher.

## 4a. Stand der Stufen

- **Stufe 1 — gebaut 27.09. (lokal, `lib/store/local-db.ts`, `lib/store/memo.ts`, Test `tests/local-db-stufe1.test.ts`):**
  Lesefehler (Rechte, E/A, Verzeichnis statt Datei) werfen `BestandNichtLesbar` statt „leer“ zu liefern — `updateJson`-Schreiber brechen damit ab,
  nichts wird mit `cur ?? {…}` überschrieben. Ein beiseitegelegter Bestand (`.corrupt-…`) wird nicht überschrieben (`BestandBeschaedigt`), bis die Kopie geprüft
  und entfernt ist. Unveränderte Stände werden nicht geschrieben (kein ETag-Sprung, kein Cache-Verlust; Ausnahme: Klartext wird bei gesetztem Schlüssel
  verschlüsselt). Lesecache je Bestand im Prozess (entschlüsselter Text, gültig bei gleichem Inode/Zeit/Größe/Schlüssel; eigene Schreibungen füllen ihn).
  Zwischenspeicher: Rauschen-Bestände (Anwesenheit, Nutzung, Änderungen, Läufe, Warteschlange, Verbrauch, Anmeldungen, Fehler, HOI-Zähler) erhöhen den
  Stand nicht mehr — die Indizes bleiben warm. Nicht gemacht: Messung vor/nach auf dem Prüfbau (kommt mit dem nächsten Prüflauf).
- **Kevins Entscheidung 27.09.: JSON bleibt.** Kein SQLite, keine Datei je Kontakt — neu bewerten ab etwa 5.000 Kontakten.
- **Stufe 2 — gebaut 27.09. (lokal):** Stand je Zeile als **Fingerabdruck des gespeicherten Datensatzes** (`lib/store/fingerabdruck.ts`, schlüsselreihenfolge-unabhängig)
  statt einer Versionsnummer, die alle 18 Kontakte-Schreiber pflegen müssten: der Browser bekommt `stand` je Kontakt und schickt ihn mit; passt er nicht mehr → 409
  mit dem aktuellen Datensatz, nichts überschrieben (`lib/store/patch-liste.ts`). `teil`-Änderungen für Kontakte (`api.kontaktTeil`; Akte, Kartei, Firmen, Runden
  nutzen sie — kein ganzer Kontakt mehr über die Leitung). Massen-Wache, Massenlösch-Schutz und Stand-Prüfung laufen in der Schreibsperre; CSV-Import und
  Lead→Mandat prüfen und schreiben in einer Sperre (Doppelklick = ein Mandat). Delta-Abgleich: der Server merkt sich je ETag die Fingerabdrücke (letzte 20 Stände)
  und schickt nur geänderte Zeilen und gelöschte Kennungen (`lib/kontakte/delta.ts`). Tests: `patch-liste-stufe2`. Funktionsprobe auf dem Dev-Server: voll → 304 →
  teil ok → alter Stand 409 → Delta mit genau einer Zeile.
- Offen aus Stufe 2: `teile.tsx`, `Kartei.tsx:268` (Anlegen), `events/Abend.tsx` senden noch ganze Kontakte (mit Stand, also sicher — nur mehr Bytes);
  Kampagnen/Heads schreiben schon in der Sperre. Stufe 3 entfällt (JSON bleibt); Stufe 4 und 5 wie geplant.

- **Paket D-A — Datenschicht-Kern und Betrieb (29.09., lokal, Prüfliste DATENARCHITEKTUR_FEHLER_PRUEFLISTE.md):**
  atomar + dauerhaft überall (`lib/store/atomar.mjs`, auch Tagessicherung, Archiv, Skripte), Sperren auf `globalThis` mit
  Wiedereintritts-/Rangfolge-Erkennung und 30-s-Zeitlimit, Lockfile `.schreiber` + Abschalt-Handler (compose 60 s),
  Kennungen `<präfix>-<uuid>`, Berliner Tag über Intl, Hülle v2 (Schlüssel-ID + AAD) mit Schlüsselring und Rotation im
  laufenden Betrieb, Klartext-Sperre, ETag mit Inode + Zähler, gzip-ETag, LRU-Lesecache 64 MB, JSON ohne Einrückung,
  Schemaversion `_v` + Migrationsrahmen (`lib/store/schema.ts`), geprüfte Nachtsicherung mit Schreibpause, age-Pflicht,
  Generationen 14/8/12, Mac-Abholung, Einzel-Restore, nächtliche Durchsicht, HOI-Messwerte, Idempotenz der
  Beleg-Übernahme, Pacht-Token, Angebots-PDF außerhalb der Sperre, Säuberer-Wächter. Tests: `tests/datenschicht-*.test.ts`,
  `sicherung-skripte`, `idempotenz-auftraege`, `kennungen`, `zeit-berlin`, `crm-saeuberer-waechter`.

- **Paket D-C — Absichtsprotokoll, zufällige Kontakt-Kennungen, Reste (29.09., lokal, Prüfliste #17/#21/#33/#35):**
  - **Absichtsprotokoll** (`lib/store/absichten.ts`, Bestand `absichten--<haushalt>`, verschlüsselt): VOR dem ersten
    Schritt eines Vorgangs über mehrere Bestände liegt eine Absicht (Art, fachlicher Schlüssel, die Daten, die die Schritte
    brauchen — bei Art. 17 Name/Adressen/HubSpot/Firma/alte Kennungen —, Schrittliste). Jeder Schritt ist idempotent und
    wird abgehakt (`mitVorgang` → `v.schritt(name, fn)`). Wiederaufnahme (`lib/store/absichten-fortsetzen.ts`): 5 s nach dem
    Start (`lib/store/betrieb.ts`), im Takt (Agent `absichten`, Absichten älter als 10 min, Rückzug 30 min je Fehlversuch)
    und vor der nächtlichen Durchsicht. Nach 3 gescheiterten Wiederaufnahmen „gescheitert“ → HOI rot (Befund `absichten`),
    von Hand über `POST /api/intern/absichten { aktion: 'erneut', id }`. Beim Abschluss werden Daten und Schlüssel geleert;
    fertige Absichten fallen nach 30 Tagen weg. Abgedeckt: **Art. 17** (13 Schritte; ein scheiternder Bestand hält die
    anderen nicht auf — Löschprotokoll-Status `laeuft`/`vollstaendig`/`unvollstaendig` mit Schrittnamen, #21; das
    Kartei-Löschen merkt die Merkmale VOR dem Schreiben vor), **Dubletten** (Kartei → `personUmbiegen`), **Import**
    (Kartei → Konflikte → Segment → Firmen → Lauf), **CRM-Folgen gelöschter Deals** (Kartei innen in der CRM-Sperre: scheitert
    das CRM-Schreiben, holt der Ausgleich die Leads zurück), **Angebot stellen** (Festschreiben → Kontakt-Vermerk; ein
    verwaistes PDF eines nicht gestellten Angebots wird entfernt) und der **Kennungs-Umzug**. Tests: `tests/absichten.test.ts`
    (Abbruch vor/nach JEDEM Schritt → derselbe Endzustand), `angebot-route`, `kennungen-umzug`.
  - **Zufällige Kontakt-Kennungen** (#35, Kevin): neue Kontakte `c-<uuid>` (`neueKontaktKennung`, lib/kennung.ts — Import,
    Kartei, Einlass, Brain-Umzug). Der fachliche Schlüssel (`schluessel`) ist nur noch Such-/Dubletten-Index; der Import
    bleibt idempotent. Altbestand: **Kennungs-Umzug** (`lib/crm/kennungen-umzug.ts`, `POST /api/crm/kennungen-umzug`,
    nur Inhaber, Karte Stammdaten › Datenqualität, nie automatisch): Vorschau → Absicht → Archivkopie → Weiterleitung
    `kennung-alias--<haushalt>` → alle Verweise über `personenUmbiegen` (ein Durchgang je Bestand, auch Import-/Zusammenführ-
    Läufe mit nachgezogenen Fingerabdrücken, alle übrigen Bestände, Protokoll-Fingerabdrücke `c2#hmac(alt)` → `c2#hmac(neu)`)
    → Kartei → Nachlese → Such-Index → Vermerk. Alte Links (`?k=`, `?kontakt=`) leitet `app/os/markttraktion/page.tsx`
    weiter. Rückweg über dieselbe Tabelle, solange kein umgezogener Kontakt geändert/gelöscht/zusammengeführt wurde (409).
    Sperrliste bleibt gültig (Merkmale), Grabsteine auch (Merkmale; Art. 17 setzt zusätzlich Grabsteine der alten Kennungen).
    Getestet an 500 erfundenen Kontakten mit Verweisen in allen Speichern (`tests/kennungen-umzug.test.ts`).
  - **Dateiablage** (`lib/store/datei-huelle.mjs`): neue `.bin` als Hülle v2 „MKOSDAT2“ mit Schlüssel-ID + AAD
    (Haushalt/Kennung), gelesen über den Schlüsselring (v1 + v2, aktiver und alter Schlüssel) — die Rotation im Betrieb
    lässt keine Datei mehr kurz unlesbar; Kennungen `d-<uuid>`. ZOE-Stapel/-Protokoll `v-`/`p-<uuid>`. Compose: Grabstein-
    Volume für die App. Zwischenspeicher-Rauschen: `anfragen-ergebnis`, `absichten--*`, `kennung-alias--*`.

## 4b. Bedrohungsmodell (29.09., Prüfliste #50/#62)

Was die Verschlüsselung im Ruhezustand schützt — und was nicht. Grundsatz: **Schlüssel und Daten liegen nie im
selben Behälter, der das Haus verlässt.**

| Angreifer / Ereignis | Was er bekommt | Schutz heute | Rest-Risiko |
|---|---|---|---|
| Kopie des Datenordners (Fehlkonfiguration, verlorene Platte, Log-Upload) | nur Hüllen (AES-256-GCM v2, AAD je Bestand) | Schlüssel liegt nicht im Datenordner | Klartext-Ausnahmen: Brain-Index, Bauplan-Bilder, `system/*.json` (nur Zähler) |
| Nachtarchiv (Server `sicherungen/`, Mac, Healthchecks-Log) | age-Chiffrat | Identität nur bei Kevin/Malin (Passwort-Manager + Papier) | Verlust der Identität = Verlust aller Archive → NOTFALL.md |
| **Hetzner-Abbild** (Konsole, Anbieter, übernommenes Hetzner-Konto) | ganze Platte: Daten **und** Schlüssel (`.env` bzw. `/srv/make-os/schluessel/daten`) | keiner — ein Voll-Abbild enthält alles | bewusst getragen: 2FA am Hetzner-Konto, Abbilder nur 7 Tage; die Datei-Lösung ändert daran nichts |
| Shell als `make` / Docker-Zugriff | Schlüssel (Umgebung per `docker inspect`, `/proc/1/environ`; Datei per `cat`) und alle Daten | SSH nur Schlüssel, fail2ban, Forced Commands für Ausrollen und Abholung | mit Schlüssel als Datei (0400) nicht mehr in `docker inspect`/Umgebung sichtbar — gegen `make` selbst schützt nichts |
| Arbeiter-/Bote-Container | kein Datenvolume, kein Datenschlüssel | compose: nur `MAKE_OS_KEY` | Dienstschlüssel öffnet die Routen |
| Untergeschobene/zurückgespielte Datei (fremder Haushalt, alte Sicherung) | — | AAD (Bestandsname) + Klartext-Sperre (#54/#55) | alte v1-Hüllen haben noch kein AAD, bis sie neu geschrieben sind |
| Rotation bricht ab | — | Rotation im Betrieb schreibt nie Klartext (Schlüsselring) | der Notweg `datenschluessel-rotieren.sh` hat weiter ein Klartext-Fenster |

Empfehlung (umgesetzt, Umstellung macht Kevin): Schlüssel als Datei `/srv/make-os/schluessel/daten` (0400, Besitzer make,
nur lesend in den App-Container gebunden, `MAKE_OS_DATEN_SCHLUESSEL_DATEI`) statt in der `.env`; die Umgebung gewinnt,
solange sie gesetzt ist — deshalb die Zeile aus der `.env` nehmen (DEPLOY.md). Der HOI zeigt die Quelle.

## 4c. Datenschutz über alle Speicher (29.09., Paket D-B — Kevin: „Top 1 %“)

- **Register statt Gedächtnis:** `lib/crm/speicher-register.ts` führt JEDEN Bestand mit Bezug (Dritte · Haushalt · kein),
  Behandlung bei Art. 17 (entfernen · tilgen · pseudonym · ausgenommen) und Grund. Der Wächter `tests/datenschutz-register.test.ts`
  scannt den Code und wird rot bei jedem neuen Namen — so wächst kein Speicher mit Personenbezug still an Art. 15/17 vorbei.
- **Art. 17 vollständig:** Kartei, CRM, Ablage, Konflikte, Heads, Replay, Signale, Aufgaben, Import-/Zusammenführ-Läufe
  (`person-bestaende.ts`) und seit 29.09. `netzwerk`, `kunden`, `stammdaten`, `prospects`, Postfach-Zwischenspeicher
  (`apple-mail-cache`, `m365-postfach`, `microsoft-inbox`, `inbox-absender`, `inbox-triage`), Kalender-Zwischenspeicher,
  `meetings`, alle `zoe-*` (auch `zoe-entscheidungen--*`), `aenderungsprotokoll--*` (Fingerabdruck → `c#geloescht`),
  `agent-log`, `client-fehler`, `meldungen--*` und die Umzugs-Kopien in `archiv/` (`person-weitere.ts`). Danach sofort:
  Such-Index `app_chunks` nachziehen (`secure_delete=ON`), `_App`-Spiegel neu erzeugen (falls an). Löschprotokoll nur mit `lp-…`.
- **Bewusst nicht gelöscht (mit Grund):** Rechnungen/Buchungen/Finanzplan (§ 147 AO / § 257 HGB), eigene Daten des Haushalts,
  Tageskopien und Nachtarchive (Löschklasse „Sicherungen“, 14 Tage bzw. Generationen — „beyond use“: nie zurückgespielt ohne
  Grabsteine).
- **Grabsteine** (`lib/datenschutz/grabsteine.ts`): HMAC der Kennung + Sperrlisten-Hashes, außerhalb des Datenordners
  (`MAKE_OS_GRABSTEINE_DIR`, Server `/srv/make-os/grabsteine` als eigenes Volume), mit ins Nachtarchiv. Angewendet nach
  jedem Restore (Restore-Skript zwingend, Einzel-Restore, Takt über die Marke `datenschutz-grabsteine`). Frist 13 Monate.
- **Absichten und Weiterleitung (29.09., Paket D-C):** `absichten--*` wird getilgt (andere Absichten), die eigene
  Art.-17-Absicht der Person behält Name/Adressen bis zum letzten Schritt (danach geleert); `kennung-alias--*`: Zeilen der
  Person raus, ihre alten Kennungen bekommen vorher eigene Grabsteine. Das Löschprotokoll trägt den Status des Vorgangs.
- **Pepper** (`lib/datenschutz/pepper.ts`, `MAKE_OS_PEPPER`): Sperrliste, Protokoll-Kennungen, Grabsteine als HMAC v2;
  v1-Hashes gelöschter Personen bleiben gültig, existierende Kontakte werden einmal je Pepper umgerechnet.
- **Art. 18 zentral** (`lib/crm/verarbeitung.ts`): Leser, die verarbeiten, sehen eingeschränkte Personen gar nicht; direkte
  Kartei-Leser nur in einer Erlaubnisliste mit Grund (Wächtertest).
- **ZOE schreibt nur über den Stapel**; Protokoll nur Kennungen + Feldnamen; Arbeitslisten 90 Tage, Entscheidungen 36 Monate.
- **Löschklassen neu:** ZOE-Arbeitslisten, ZOE-Entscheidungen, ZOE-Verlauf, ZOE-Gedächtnis, Postfach-/Kalender-Zwischenspeicher,
  Umzugs-Kopien im Archiv (30 Tage; andere Archiv-Dateien bleiben, nie automatisch), Altbestand Netzwerk (nur Aufgabe),
  Grabsteine, Sicherungen (fest) — Tabelle `lib/crm/loeschfristen.ts`, Lauf `loeschfristen-lauf.ts`.

### Art. 17 im Vault und in seiner Git-Historie (#98)

Der Vault ist Wahrheit des Brain und liegt in drei Kopien (Server `/srv/make-os/vault`, GitHub `make-vault`, Mac
`~/Vaults/MAKE/Make.Claude`) — jede mit voller Git-Historie. Personenbezug dort klein halten (Links in die App statt Kopien;
der `_App`-Spiegel trägt nur Titel/Links, nie Art.-18-Kontakte). Muss eine Person auch aus dem Vault verschwinden:

1. **Finden:** am Mac im Vault `git grep -n -i "<Name>"` und `git log -S "<Name>" --oneline` (auch Adresse, Telefon).
   Treffer im `_App`-Spiegel verschwinden von selbst (Art. 17 in der App erzeugt ihn neu) — sie stehen aber in der Historie.
2. **Heutigen Stand bereinigen:** Notizen von Hand ändern (Name → „[gelöscht]“), committen, Abgleich laufen lassen.
3. **Historie umschreiben** (erst, wenn alle drei Kopien abgeglichen sind; der Abgleich-Dienst am Mac und der Cron auf dem
   Server kurz anhalten): in einer frischen Klon-Kopie
   `git filter-repo --replace-text ausdruecke.txt` (Datei mit `Name==>[gelöscht]` je Zeile, liegt NUR lokal und wird danach
   gelöscht) bzw. `--invert-paths --path "<Notiz>.md"` für ganze Notizen; dann `git push --force --all` nach GitHub.
4. **Alle Kopien ersetzen:** Server-Vault und Mac-Vault NICHT pullen, sondern neu klonen (alte Ordner beiseitelegen, nach
   Prüfung löschen) — sonst bringt ein alter Klon die Historie zurück. GitHub: Support um Löschung der gecachten Ansichten
   bitten, falls die Notiz dort je angezeigt wurde.
5. **Sicherungen:** Nachtarchive enthalten den Vault nicht (er kommt aus GitHub); `.git`-Kopien in Time Machine o. Ä. laufen
   mit ihrer Frist aus.
6. **Festhalten:** im Löschprotokoll der App steht die Löschung (`lp-…`); im Vault nur „Historie bereinigt am …“ ohne Namen.

## 5. Offene Entscheidungen für den 27.09.

- Speicher: JSON optimiert · JSON je Kontakt · SQLite (mit Verschlüsselungskonzept).
- Reihenfolge: Stufe 1 → 2 → (3) → 5, Stufe 4 später (Kevins Entscheidung 26.09.).
- Messen vor/nach jeder Stufe: Öffnen Markttraktion (Zahl der Lesevorgänge, ms), Kontakt-Änderung (ms, Bytes),
  Trefferquote Zwischenspeicher; Testkonto + Prod-Bau (`make-os-pruefbau`, Port 3011) wie bei der Durchsicht am 26.09.

## 6. Regeln, die dabei gelten

- Daten liegen nur auf dem Server; lokal nie Echtdaten ändern oder hochladen (`deploy/daten-hochladen.sh` nie).
- Jede Datenübernahme zuerst als Vorschau, dann mit Bestätigung; vorher Voll-Export nach `.data/archiv`.
- Hochladen nur auf Kevins ausdrückliches Wort; bauen und zeigen lokal.
- Tests, die fehlen und mit Stufe 1/2 kommen: gleichzeitige `updateJson`-Aufrufe, `listePatchen`, „Lesefehler wird leer“,
  Routen-Tests für gleichzeitige PATCHes auf `bestand`/`kontakte`.
