# MAKE OS — Der Plan zum Hochfahren

Stand 18.09.2026. Ersetzt `UMSETZUNGSPLAN.md` (dessen Pakete sind erledigt).

Kevin, 18.09.: *„mit der Spielerei aufhören, sondern jetzt wirklich punktuell
die einzelnen Bereiche fertig bauen, sodass wir diese dann auch wirklich jetzt
einfach benutzen können."*

Das ist die Regel für alles hier: **Ein Bereich wird fertig, wird benutzt, dann
der nächste.** Nichts wird angefangen, solange der vorherige nicht im Alltag
läuft.

---

## 1 · Die vier Entscheidungen (18.09.)

| Frage | Entscheidung | Was das bedeutet |
|---|---|---|
| Neu oder Bestand? | **Bestand bleibt**, wird sauber strukturiert | Kein Neubau. 46.000 Zeilen, Regeln, Tests bleiben. Was nicht gebraucht wird, wird nicht angefasst — nur aus dem Weg geräumt. |
| Wo läuft es? | **Hetzner** (Deutschland) | Beide von überall, auch vom Handy. Jarvis läuft, wenn der Mac aus ist. **Bricht bewusst die Regel „nichts in fremder Cloud"** — siehe Abschnitt 3. |
| Google? | **Alles** — Kalender, Gmail, Kontakte, Drive — **plus der Obsidian-Vault auf dem Server** | Google wird dritte Anbindung neben Apple und M365. Der Vault wandert per Git. |
| Wer führt? | **MAKE OS steht über allem.** Jarvis wird angesprochen und setzt um. **Prozesse müssen Kevin und Malin selbst bauen können.** | Erinnerungen, Mail, Kalender sind Quellen, nicht Chefs. Jarvis bekommt Prozesse, nicht Code. Erster Prozess: ein Dokument kommt über die App herein und wird aufgenommen. |

---

## 2 · Was den Bestand heute an Kevins Mac fesselt

Vor dem Hochfahren muss das hier weg, sonst ist die Software auf dem Server
nur halb da.

| Fessel | Wo | Ersatz |
|---|---|---|
| **AppleScript** in 10 Routen (Kalender, Erinnerungen, Mail, Kontakte, Tagesstart) | `app/api/apple-*`, `app/api/tagesstart` | iCloud spricht offene Protokolle: **CalDAV** (Kalender + Erinnerungen), **CardDAV** (Kontakte), **IMAP/SMTP** (Mail). Ein App-Passwort je Person, läuft von jedem Linux aus. |
| **Vault-Pfad** = iCloud-Ordner auf dem Mac | `lib/jarvis/vault.ts` | Der Vault wird ein **Git-Repo**. Kevin und Malin: Obsidian-Git-Plugin. Server zieht alle fünf Minuten. Pfade aus der Umgebung, nicht fest verdrahtet. |
| **Ein Schlüssel für alle**, Person per Cookie | `middleware.ts`, `lib/jarvis/raum.ts` | **Zwei Konten** mit Passwort. Die Person kommt aus der Anmeldung, nicht aus einem Cookie, das jeder setzen kann. Der Schlüssel bleibt nur für den Arbeiter. |
| `start.sh`, `caffeinate`, Node in `~/.local` | Startskript | **Docker Compose**: App, Arbeiter, HTTPS-Proxy. Neustart von allein. |
| Daten als JSON auf dem Mac | `.data/` | Bleibt JSON — **auf einem Server-Volume** mit nächtlicher Sicherung. 7 MB, zwei Nutzer, serialisierte Schreibvorgänge, Wächter: das reicht. Postgres erst, wenn Dritte dazukommen. |
| Kein Git | Projektordner | `git init`, privates GitHub-Repo. **Ohne das geht nichts weiter** — zwei Leute an einem Code brauchen Git. |

---

## 3 · Die Cloud-Regel, ehrlich

Bisher galt: Gesundheit, Journal, Finanzen bleiben auf dem eigenen Rechner.
Auf Hetzner liegen sie bei einem Anbieter. Das ist eine bewusste Entscheidung,
und sie wird so abgesichert:

1. **Standort Deutschland** (Falkenstein), deutscher Anbieter, DSGVO.
2. **Verschlüsselte Platte** auf dem Server; Backups verschlüsselt.
3. **Zugang nur mit Passwort + Gerät** — kein Link, der weitergegeben werden kann.
4. **Kein Dritter** hat einen Zugang. Alex und Frank bekommen weiterhin nur Rohbau.
5. **Wöchentliche Sicherung zurück auf Kevins Mac** — wenn Hetzner morgen weg wäre, wäre nichts verloren.
6. **Schlüssel** liegen nur in der Server-Umgebung, nie im Repo, nie im Vault.

Was **nicht** auf den Server geht: die privaten Ordner von Malin im Vault
(bleiben draußen, wie entschieden) und `Beteiligungen_Status.md`.

---

## 4 · Die Phasen

> **Änderung 23.09.:** Kevin hat die Reihenfolge gedreht — **Gesundheit
> zuerst.** *„Gesundheit ist die Basis, deswegen bauen wir ihn zuerst und
> bringen ihn live."* Der Bereich war gebaut, aber tot (Vitalwerte zuletzt
> 03.08., Journal leer). Seit 23.09.: Telegram-Bote, Tagestakt morgens/
> mittags/abends, Haut-Tagebuch, Streak, vier Jarvis-Werkzeuge, Malin sieht
> alles. Was Kevin dafür tun muss: Bot-Token (@BotFather) und Whoop-Developer-
> Zugang. Die Phasen unten gelten danach, in dieser Reihenfolge.

> **Änderung 23.09. (nachmittags): echte Konten.** Kevin: *„dieses Kevin/Malin-
> Thema geht einfach raus … das wollen wir später evtl. verkaufen. Also baue es
> so, dass es wirklich alles mit Login funktioniert."* Gebaut: Konten mit
> E-Mail + Passwort (`lib/zugang/`), signierte Sitzungen, Rollen Inhaber/
> Mitglied, Einladungscodes, Seite `/anmelden`, Kontoseite `/os/konto`. Der
> Zugangsschlüssel dient nur noch dem Dienstweg und dem ersten Konto. Jedes
> Konto hat einen **Speichernamen** (Kevin → `kevin`, Malin → `malin`) — die
> gewachsenen Datendateien hängen damit ohne Umzug am richtigen Konto.
> „Gesundheit teilen" ist jetzt eine Einstellung je Person, kein globaler
> Schalter. Damit ist Phase 1, Schritt 3 (Anmeldung) vorgezogen erledigt.

> **Änderung 23.09. (abends): die schlanke Oberfläche.** Kevin: *„Das ist
> grausig … wie würdest du es maximal verschlanken?"* Befund: 50 Seiten in 7
> Bereichen, drei Navigationen übereinander, 11 Mitläufer auf jeder Seite,
> Rahmen um alles, Nullen als große Zahlen. Gebaut: **eine Leiste, eine Ebene,
> sechs Einträge** (Heute · Inbox · Gesundheit · Aufgaben · Zahlen · Kontakte,
> dazu das Zahnrad „System"), auf dem Handy als Leiste unten. Weg: Bereichs-
> Cockpit, Modus-Schalter, Onboarding-Erinnerung, Zurufe, Bauzeit-Hinweis,
> Personen-Schalter. **Gesundheit ist EINE Seite mit vier Segmenten** (Heute ·
> Verlauf · Ernährung · Körper) nach Whoops Regeln: keine Rahmen, eine Schrift,
> große Zahlen, eine Farbe je Kennzahl, nie eine Null. Journal, Tagesstart,
> Fokus, Energie, Wochen-Rhythmus und die Gesundheits-Säule gehen darin auf;
> alte Adressen leiten weiter. Die anderen Bereiche bleiben erreichbar und
> werden nach demselben Muster zusammengelegt — einer nach dem anderen.

> **Änderung 23.09. (spät): der Rest auf das Muster — „fertig machen, dass ich
> damit arbeiten kann".** Drei weitere Seiten nach denselben Regeln, alle aus
> einem Baukasten (`components/os/schlank.tsx`: Seite, Zeile, Liste, Haken,
> Ring, Segmente — keine Rahmen, nie eine Null):
> - **Heute** (`/os`, `HeuteView`): Score-Ring mit den fünf Säulen, Fokus,
>   Termine des Tages, fällige und kritische Aufgaben zum Abhaken, eine Zeile
>   Körper, eine Zeile Jarvis-Stapel. Das alte Dashboard liegt unter
>   `/os/uebersicht` (über System erreichbar), bis nichts mehr fehlt.
> - **Aufgaben** (`/os/aufgaben`, `AufgabenSchlank`): eine Zeile zum Anlegen
>   mit Kürzeln (`!!` kritisch · `heute`/`fr`/`24.09.` · `#projekt` · `@malin`),
>   dann Überfällig · Heute · Diese Woche · Später · Ohne Datum, Erledigt
>   einklappbar. Board, Zeitstrahl und Filter unter `/os/aufgaben/board`.
> - **Kontakte** (`/os/crm`, `KontakteView`): das CRM vom 18.09. hat jetzt
>   eine Oberfläche. Heute = wer dran ist (Regel `tagesliste`), Alle = Suche
>   über 443 Kontakte nach Priorität, Mandate = die bisherige Ansicht. Karte
>   je Kontakt: Aufhänger, Marktinfo, **Entwurf** (Jarvis schreibt Mail +
>   LinkedIn) → **In Mail öffnen** (Apple-Mail-Entwurf, Versand bleibt bei
>   Kevin), Griffe LinkedIn/Mail geschickt · Antwort · Termin, Stufe als
>   Auswahl. Erstimport der Masterliste per Knopf (443 gelesen, 130 ansprechbar).
> Geprüft: Typprüfung sauber, 158 Tests grün, alle drei Seiten am Schreibtisch
> und auf dem Handy mit einem Wegwerfkonto durchgespielt (angelegt, benutzt,
> gelöscht — Kevins Daten unberührt). Damit ist **Phase 3 (CRM) in der
> Oberfläche fertig** und Phase 2 (Aufgaben) benutzbar.
>
> Nachtrag, dieselbe Nacht („los alles fertig machen"): **Inbox und Zahlen**
> ebenfalls umgebaut — jetzt ist jeder Eintrag der Leiste im neuen Muster.
> - **Inbox** (`/os/inbox`, `InboxSchlank`): eine Liste, Jarvis stuft ein
>   (Wichtig · Normal · Rauschen), fällige Wiedervorlagen oben, Rauschen
>   eingeklappt und in einem Zug erledigt. Je Mail: Erledigt · Aufgabe ·
>   Morgen · Montag · Delegiert · Antwort (Jarvis schreibt, Apple Mail öffnet,
>   gesendet wird von Hand) · Absender blocken. Tasten j/k/e/a/s bleiben.
>   Fächer, Screener und Zero-Durchlauf liegen unter `/os/inbox/voll`.
> - **Zahlen** (`/os/finanzen`, `ZahlenView`): Kontostand als Heldenzahl,
>   darunter 12-Wochen-Stand, muss raus, kommt rein; Malins Grundlage als
>   Zahlenreihe; als Nächstes fällig; der laufende Monat mit Kategorien;
>   die sechs Unterbereiche als Liste. Die Unterseiten sind unverändert.
> Offen bleiben nur Kevins Freischaltungen (Konto, Telegram, Whoop) — und
> dann Phase 1, Hetzner.

> **Nachtrag 24.09., Einstieg geprüft.** Kevin: *„überprüfe auch den eigenen
> Onboarding-Prozess."* Durchgespielt mit Wegwerfkonten: erstes Konto →
> Einladungslink erzeugen → abmelden → Link öffnen → beitreten → Heute.
> Gefunden und behoben: **nach der Anmeldung luden Aufgaben und Kalender
> nicht** (die Kontexte starteten auf der Anmeldeseite ohne Sitzung und
> zeigten danach den Beispiel-Zustand, ohne zu speichern). Jetzt lädt die
> Anmeldung die Seite neu, und die Kontexte warten auf die Sitzung. Dazu:
> Einladung als **Link** (`/anmelden?code=…`, Code vorbelegt), Konto-Seite im
> schlanken Muster, Empfang führt zu Heute, Onboarding-Schritte auf den
> Konten-Weg umgeschrieben (Bauzeit-Schritt raus), Aufgaben mit Karte (Datum,
> Priorität, Wer, Projekt, Löschen), Schnellanlage auf Heute. Kevins Konto ist
> angelegt (Speicher `kevin`).

> **Nachtrag 24.09., lebendig.** Kevin: *„nach Whoop sieht das gerade nicht
> aus, das sieht so tot aus, ich soll doch Spaß haben, da reinzugucken."*
> Berechtigt: schlank war zu Askese geworden — Haarlinien auf Schwarz, gedämpfte
> Farben, Striche. Whoops Rezept nachgebaut, ohne die Regeln vom 23.09. zu
> brechen: **dunkle Karten mit Tiefe** statt Haarlinien (`.karte`),
> **Leuchtfarben** je Kennzahl (`LEUCHT` in design.ts: grün/gelb/rot, Schlaf,
> Puls, Geld, Business, Planung, Beziehung), **Ringe mit Glow** und der Zahl
> innen, **Zahlen, die hochzählen**, **Trendbalken**, **Zone-Chips**, und alles
> **erscheint gestaffelt** (`os-auf`). Begrüßung mit Namen auf Heute, die fünf
> Säulen als kleine Ringe, Körper und Jarvis als zwei Karten. Bausteine in
> `components/os/schlank.tsx`, alle sechs Seiten plus Konto darauf. Geprüft mit
> kopflosem Chrome (Screenshots Rechner und Handy) und Wegwerfkonto.

> **Nachtrag 24.09., Wachstum und Jarvis.** Kevin: *„Nimm Jarvis erst weg,
> dass er nicht immer vorweg kommt. Nimm als Score das ganze Thema Wachstum mit
> rein, einen eigenen Bereich. Und nimm Jarvis links als eigene Seite mit rein."*
> Gebaut: Nach der Anmeldung landet man auf **Heute**, nicht mehr im Empfang.
> **Wachstum** (`/os/wachstum`, `WachstumView`) ist ein eigener Eintrag: der
> MAKE Score groß mit Abdeckung, Bestwert und Verlauf; die fünf Säulen mit
> Gewicht, Chip und aufklappbaren Faktoren (echt gemessen oder nicht, mit
> Quelle); Ziele je Horizont (Jahr · Quartal · Monat) mit Fortschritt; Fokus.
> `/os/performance` leitet dorthin. **Jarvis** steht als letzter Eintrag links
> (`/jarvis`, der Empfang bleibt, man geht hin, wenn man will). Die Leiste hat
> jetzt acht Einträge plus System; auf dem Handy: Heute · Inbox · Gesundheit ·
> Wachstum · System. System-Seite ebenfalls auf Karten. Kontrollgang: keine
> alten Farben oder Haarlinien mehr in den neuen Ansichten.

> **Nachtrag 24.09., der Wachstums-Score über allem.** Kevin: *„Ich möchte,
> dass der Wachstumsscore oben drüber steht und im Grunde genommen der Score
> ist, auf den wir hinarbeiten. Wir wollen immer Wachstum, uns optimieren,
> Unternehmertum, Firmen optimieren, mehr Geld verdienen …"* Gebaut: Der Score
> heißt jetzt überall **Wachstums-Score** und steht als fester Kopf über jeder
> Seite (`WachstumsKopf` im /os-Layout, klebt oben, wie Whoop seine Kennzahlen
> trägt): Ring mit Zone, Veränderung zur letzten Messung, größter Hebel, die
> fünf Säulen als winzige Ringe, ein Klick führt in den Bereich Wachstum. Heute
> hat deshalb keine eigene Score-Karte mehr. Wachstum steht in der Leiste direkt
> nach Heute, auch auf dem Handy. Die Beschreibung des Bereichs trägt Kevins
> Satz. Die Gewichte (Gesundheit 35 · Business 20 · Planung 15 · Finanzen 15 ·
> Beziehung 15) sind unverändert — das ist Kevins Entscheidung, wenn er den
> Score stärker auf Unternehmertum und Geld drehen will.

> **Nachtrag 24.09., Agenten-Score.** Kevin: *„Ich möchte oben bei den Scores
> auch noch einen Agenten-Score mit reinnehmen. Jedes Mal, wenn wir auf den
> Score klicken, kommen wir direkt auf die Seite, wo es weitergeht."* Gebaut:
> **Agenten** ist die sechste Säule des Wachstums-Scores (`lib/agenten-score.ts`,
> rein und getestet): Agenten live · Läufe diese Woche · Aufträge erledigt ·
> Stapel fließt · Bote erreicht dich — alles aus vorhandenen Daten
> (Agenten-Log, Aufträge des Arbeiters, Stapel, Telegram). Gewichte jetzt:
> Gesundheit 35 · Business 20 · Finanzen 15 · Planung 10 · Beziehung 10 ·
> Agenten 10. Im Kopf über jeder Seite ist **jeder Score ein eigener Sprung**:
> Gesundheit → /os/gesundheit, Business/Planung/Beziehung → ihre Säulen-Seite,
> Finanzen → /os/finanzen, Agenten → /os/agenten, der große Ring → Wachstum.

Jede Phase hat ein Ziel in einem Satz, eine Fertig-Bedingung, und eine Liste,
was **bewusst nicht** darin ist. Grobe Größe in Arbeitstagen — ehrlich grob.

### Phase 1 — Hochfahren · ~5 Tage

**Ziel:** Malin und Kevin arbeiten online im selben System, jeder mit eigenem
Zugang.

Was gebaut wird:
1. `git init`, `.gitignore` geprüft (`.data`, `.env.local` draußen), privates GitHub-Repo, Malin eingeladen.
2. `Dockerfile` + `compose.yml`: App, Arbeiter, Caddy (HTTPS von allein). Volume für `.data` und den Vault.
3. **Anmeldung:** `lib/zugang.ts` — zwei Konten (bcrypt), Seite `/anmelden`, signierte Sitzung, `personAus()` liest die Sitzung. `x-make-key` bleibt als Dienstschlüssel für den Arbeiter.
4. **Vault per Git:** Repo für den Vault, Server zieht per Cron, `vault.ts` liest Wurzeln aus `VAULT_WURZELN`.
5. **Apple-Routen entschärfen:** auf Linux antworten sie sauber „wird in Phase 4 über iCloud angebunden" statt abzustürzen.
6. **Deploy:** GitHub Action — Push auf `main` → Server zieht → `docker compose up -d --build`. Zwei Minuten, dann live.
7. **Sicherung:** nächtlich verschlüsselt auf eine Hetzner Storage Box, wöchentlich Kopie auf Kevins Mac.
8. **Umzug:** `.data/` einmalig auf den Server. Der Mac ist danach Entwicklungsrechner, nicht mehr Betrieb.

Was Kevin tun muss: siehe Abschnitt 6.

**Fertig, wenn:** Kevin am Mac und Malin am Handy sind beide angemeldet, einer
legt eine Aufgabe an, der andere sieht sie.

**Bewusst nicht:** Postgres, Coolify, Domain-Kosmetik, Design.

### Phase 2 — Aufgaben · ~3 Tage

**Ziel:** Der Tag läuft über MAKE OS. Beide legen an, weisen zu, haken ab —
und nichts geht verloren.

Was da ist: Board, Delegation, Filter, Fälligkeit, Kevin/Malin-Trennung,
Massen-Wache. Was fehlt:
1. **Rückgängig** für Löschen und Erledigen (Bauplan Prio 1 — ohne das traut sich niemand zu klicken).
2. **Schnell anlegen** von überall: eine Zeile, per Jarvis, per Stimme — landet richtig zugeordnet.
3. **Zuweisen an Jarvis:** eine Aufgabe „an Jarvis" heißt: er versucht sie mit seinen Werkzeugen, legt das Ergebnis in den Stapel.
4. `AufgabenView.tsx` (1.275 Zeilen) in drei Teile — nicht aus Schönheit, sondern weil jede Änderung darin heute riskanter ist als nötig.
5. Wochensicht prüfen: die Woche planen, ohne Überlappungen (Kevins Kritik vom 03.08.).

**Fertig, wenn:** eine Woche lang beide damit gearbeitet haben und keine Aufgabe verloren ging.

**Bewusst nicht:** Erinnerungen-Abgleich (braucht CalDAV → Phase 4), Zeitstrahl-Feinheiten, Kapazitätsschätzung.

### Phase 3 — CRM · ~3 Tage

**Ziel:** Jeden Morgen wissen, wen man heute anspricht — und es tun.

Was da ist (18.09.): die Regeln in `lib/make-one/crm.ts` mit 23 Tests — Import
der Masterliste ohne Dubletten, Tagesliste (fällige Wiedervorlagen, dann Prio
A/B mit Aufhänger und Kanal), Stufen nur vorwärts, Wiedervorlage nach
Ansprache. Fünf Routen. Drei Jarvis-Werkzeuge (`suche_kontakt`,
`notiere_kontakt`, `entwurf_ansprache`). Agent `crm` live.

Was fehlt:
1. **Oberfläche `/os/crm`:** Tagesliste oben, Kontaktkarte mit allem, was die Anreicherung weiß, Pipeline als Spalten, Import-Knopf, „Entwurf → in Mail öffnen".
2. **Mandate** (die alte Kunden-Liste) als zweiter Reiter — die drei Einträge bleiben.
3. **Netzwerk** (731 Adressbuch-Kontakte): daneben, nicht hinein. Ein Kontakt, der im CRM landen soll, wird per Klick übernommen.
4. Erster echter Lauf: Masterliste importieren, zehn Ansprachen raus, zehn notiert.

**Fertig, wenn:** Kevin drei Tage hintereinander die Tagesliste abgearbeitet hat und die Stufen stimmen.

**Bewusst nicht:** Brevo-Anbindung, Sequenzen, Forecast, Kampagnen.

### Phase 4 — Anbindungen · ~5 Tage

**Ziel:** Alles, was per Mail, Termin oder Erinnerung hereinkommt, kommt in
MAKE OS an — von jedem Gerät, ohne dass ein Mac läuft.

1. **iCloud über CalDAV/CardDAV/IMAP** (Kevin und Malin je ein App-Passwort): Kalender lesen und anlegen, **Erinnerungen in beide Richtungen** (Siri unterwegs → Aufgabe in MAKE OS), Kontakte, Mail lesen und Entwürfe anlegen. Die zehn AppleScript-Routen werden dadurch ersetzt.
2. **M365** fertig verdrahten (OAuth steht): Postfach und Firmenkalender.
3. **Google** als dritter Anbieter in `lib/oauth.ts`: Kalender, Gmail, Kontakte, Drive.
4. **Inbox** zeigt alle Postfächer in einer Liste, Kalender alle Kalender.

**Fertig, wenn:** eine per Siri angelegte Erinnerung nach zwei Minuten als Aufgabe in MAKE OS steht, und die Inbox alle drei Postfächer zeigt.

**Bewusst nicht:** Whoop, Vivid, Miro — bleiben gebaut, warten auf Zugänge, blockieren nichts.

### Phase 5 — Prozesse · ~5 Tage

**Ziel:** Jarvis nimmt Arbeit ab — nach Regeln, die Kevin und Malin selbst
schreiben, ohne Code.

1. **Dokument-Aufnahme** — der erste Prozess, Kevins Beispiel: Ein Dokument kommt über die App (Upload), per Mail-Anhang oder in einen Drive-Ordner → Jarvis erkennt die Art (Rechnung, Vertrag, Beleg, Sonstiges) → zieht die Daten heraus → legt es nach Ordnerregel ab (iCloud-Belege / Drive) → schlägt vor, was folgt (Buchung, Aufgabe, Wiedervorlage) → in den Stapel.
2. **Prozess-Baukasten** `/os/prozesse`: ein Prozess ist eine Datenstruktur, kein Code — *Auslöser* (Dokument kommt · Mail von X · Zeitpunkt · Zuruf) → *Schritte* (Werkzeuge aus dem Register, mit Eingaben) → *Freigabe ja/nein*. Die Risikotabelle gilt weiter: ein Prozess kann nichts, was ein Werkzeug nicht darf.
3. Jarvis liest die Prozesse in seine Anweisung und führt sie über `fuehreAus()` aus — derselbe eine Weg wie heute.
4. Der Name „Jarvis" wird eine Einstellung. Kevin: *„dessen Name gerade noch Jarvis ist."*

**Fertig, wenn:** Kevin ein Foto einer Rechnung über die App schickt, sie abgelegt ist und die Buchung im Stapel liegt — ohne dass er etwas anderes getan hat.

**Bewusst nicht:** ein grafischer Flow-Editor. Eine Liste von Schritten reicht.

### Danach

Was der Alltag verlangt — in dieser Reihenfolge, nicht früher: Finanzen mit
echten Kontoständen (Vivid), Gesundheit mit Whoop, Postgres wenn Dritte
dazukommen, dann „anderen freigeben".

---

## 5 · Was geparkt wird

Aus dem Bauplan (72 offene Punkte). Nichts davon ist gelöscht — es steht nur
nicht im Weg.

- Neuronale Stimme für Jarvis · Empfangs-Effekte · Score-Vervollständigung · Firmensuche · Anwesenheits-Automatik · Live-Abgleich statt Poll · Säulen-Seiten zusammenlegen · Einkaufsliste teilen · Kunden-Ordner-Zugriff · Vault entdoppeln (Kevins Entscheidung, welche Fassung führt)
- Whoop, Vivid, Miro: gebaut, warten auf Zugänge

---

## 6 · Was Kevin selbst tun muss

Gesammelt, damit es einmal erledigt ist. Nichts davon kann Claude — es sind
Konten, Schlüssel und Entscheidungen.

| # | Was | Wofür | Wann |
|---|---|---|---|
| 1 | **GitHub:** SSH-Schlüssel des Macs hinterlegen, privates Repo `make-os` anlegen (ohne README) | Phase 1, Schritt 1 | jetzt |
| 2 | **Hetzner:** Konto, Cloud-Server CX22 in Falkenstein, Ubuntu 24.04, denselben SSH-Schlüssel hinterlegen, Server-IP an Claude. Dazu eine **Storage Box** (kleinste) für Sicherungen | Phase 1 | jetzt |
| 3 | **Subdomain** für die Software (z. B. `os.` unter einer Domain, die du hast) — A-Record auf die Server-IP | HTTPS | Phase 1 |
| 4 | **Passwörter** für dich und Malin — persönlich vereinbaren, nie per Chat | Anmeldung | Phase 1 |
| 5 | **iCloud App-Passwörter** (appleid.apple.com → Anmeldung & Sicherheit → App-spezifische Passwörter), eins für dich, eins für Malin | Kalender, Erinnerungen, Mail, Kontakte | Phase 4 |
| 6 | **Google Cloud:** ein Projekt, OAuth-Client (Claude führt durch) | Google | Phase 4 |
| 7 | **Malins Mac:** Obsidian-Git-Plugin, Repo-Zugang | Vault | Phase 1 |
| 8 | Entscheidung: **welche Vault-Fassung führt** (Desktop/MAKE vs. iCloud) — offen seit 07.09. | Gehirn | Phase 1 |

Schlüssel und Passwörter gehen **nur** in `.env.local` (lokal) und in die
Server-Umgebung. Nie in Mail, Chat, Vault oder Repo.

---

## 7 · Die nächsten zehn Arbeitstage

| Tag | Was |
|---|---|
| 1 | Git, GitHub, Dockerfile, Compose — läuft lokal in Docker |
| 2 | Anmeldung mit zwei Konten, Sitzung, Person aus Sitzung |
| 3 | Server: Compose, Caddy, Volume, Deploy-Action, erste Live-Adresse |
| 4 | Vault per Git, Apple-Routen entschärft, `.data` umgezogen |
| 5 | Sicherung, Malin meldet sich an — **Phase 1 fertig** |
| 6–7 | Aufgaben: Rückgängig, Schnellanlage, „an Jarvis", View geteilt |
| 8 | Aufgaben: Woche prüfen — **Phase 2 im Alltag** |
| 9–10 | CRM-Oberfläche, Import, erste Ansprachen — **Phase 3 fertig** |

Danach Phase 4 und 5, jeweils erst, wenn die vorherige im Alltag läuft.

---

## 8 · Was sich an der Arbeitsweise ändert

- **Keine Spielerei.** Kein Effekt, keine Animation, kein Umbau „weil es schöner wäre". Nur, was einen Bereich fertig macht.
- **Jede Phase endet mit Benutzen**, nicht mit „gebaut". Die Fertig-Bedingung ist ein Satz über den Alltag, nicht über Code.
- **Tests bleiben Pflicht** für Regeln (`.ts`), nicht für Oberflächen.
- **`main` ist immer live-fähig.** Was auf `main` liegt, geht auf den Server.
- **Kevin entscheidet das Was, Claude das Wie.** Bei Richtungsfragen: klickbare Runde, dann los.
