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

## Online seit 26.09.2026 (Stand `ba4ef3a`, ausgerollt 11:44)

Alles aus dem Block „Nächstes Update“ unten ist seit 26.09. mittags online (Next 15.5, Sicherheits-Wellen 1–3,
Gesundheits-Index, Traktions-Index, keine toten Stellen). Der Block bleibt als Ansage stehen, bis das nächste
Update ihn ablöst.

## Nächstes Update — vorbereitet, noch nicht online

_(hier sammeln, was auf `entwicklung` fertig ist)_

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

## Ablauf eines Updates (Checkliste)

1. Auf `entwicklung`: `tsc`, `next lint`, `vitest run` grün; Probe-Build (`MAKE_OS_DIST=.next-pruefbau npx next build`, danach Ordner löschen).
2. Liste oben „Nächstes Update“ vollständig — das ist die Ansage an Kevin & Malin.
3. Zeitpunkt wählen, an dem niemand mitten in der Arbeit ist (Ausrollen ~5 Min., die alte Version läuft solange weiter).
4. Kevin: `git -C ~/Claude/Projects/MakeOS switch main && git -C ~/Claude/Projects/MakeOS merge --ff-only entwicklung && git -C ~/Claude/Projects/MakeOS push && git -C ~/Claude/Projects/MakeOS switch entwicklung`
5. Warten, bis GitHub ausgerollt hat — **nicht** parallel von Hand ausrollen (sonst stoßen zwei Auslieferungen zusammen).
6. Prüfen über **eine** SSH-Verbindung (ControlMaster), keine Schleifen — sonst sperrt der Server die eigene Adresse bis zu 1 h.
7. Einmalige Schritte des Updates erledigen (siehe unten), dann Liste „Online“ nachtragen.

## Einmalige Schritte, die noch offen sind

- ~~iCloud-Kalender verbinden~~ — erledigt 25.09. (Befehl bleibt zum Wechseln des Passworts):
  vorher bei Apple ein app-spezifisches Passwort „MAKE OS“ anlegen (appleid.apple.com → Anmelden & Sicherheit), dann
  `ssh -t make@2.28.108.162 sudo bash /srv/make-os/app/deploy/icloud-verbinden.sh <apple-id>` (fragt dann nur das App-Passwort)
  — Alternative ohne Terminal: eine Eingabe „iCloud verbinden“ unter System (nur Inhaber, verschlüsselt gespeichert), wenn gewünscht.
