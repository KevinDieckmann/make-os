# MAKE OS — Projekt-Regeln

Das private Life & Business OS von Kevin & Malin. Eigenständiges Projekt —
bewusst getrennt von KEMARIS (Firma) und CapOS (Produkt). Next.js 14, läuft
lokal, Route `/os`, Port 3001.

## Team & Sprache
- Antworte auf Deutsch. Kevin bevorzugt klickbare Entscheidungsrunden
  (AskUserQuestion) bei offenen Richtungsfragen.
- Malin und Kevin haben beide vollen Zugriff auf alles in diesem System.
- Diktat-Falle: „Berlin" oder „Marlene" im Diktat meint meist **Malin**.

## Leitbild & Terminologie (Kevin & Malin, 01.08.2026)
- **Jarvis-Mentalität, immer:** Wir arbeiten dauerhaft an unserer eigenen
  Software weiter. Ziel ist EINE zentrale Intelligenz mit allen Daten über
  alle Beteiligungen, die auch Familie & Alltag mitsteuert — Fernziel ein
  Sprach-Assistent zu Hause. Immer nach ethisch/moralisch sauberen Maßstäben.
- **KD Ventures UG ist DIE Firma.** Gegründet als „KD Management UG" — dieser
  Name wird überall ersetzt und nie mehr verwendet. KEMARIS ist nur eine
  Beteiligung der KD Ventures (Kevins Hauptfokus, aber Risiko wird gestreut).
  KD-Ventures-Aktivitäten gehen **nie in Konkurrenz zu KEMARIS** — sie ist die
  größte Beteiligung und das größte Gut.
- **Synonyme im Sprachgebrauch:** „die Selbständigkeit" = Kevin Dieckmann
  Consulting (Einzelunternehmen) · „die Beteiligungsgesellschaft" = KD Ventures UG.
- **Malin ist Gesundheits-Beauftragte** (Sport, Ernährung, Hyrox-Pro-Ziel) —
  Gesundheitsthemen laufen über sie.
- **Kritisch pulsiert:** Priorisierung nach Eisenhower; kritische Aufgaben
  werden im System visuell pulsierend hervorgehoben.

## Eiserne Regeln
1. **Privates bleibt hier.** Gesundheits-, Journal- und Finanzdaten gehören
   Kevin & Malin. `.env.local` und `.data/` sind gitignored und bleiben es —
   niemals Schlüssel oder echte Daten committen oder in Code schreiben.
2. **Rohbau-Regel:** An Dritte (z. B. Alex/KEMARIS) geht nur Code, Struktur
   und Regeln — niemals Daten. Das Repo ist genau so geschnitten.
3. **Human-in-the-Loop:** Nichts verlässt das System Richtung Dritter ohne
   Freigabe von Kevin oder Malin. Interne Planung/Buchführung (plan_block,
   Erfassungs-Werkzeuge) darf direkt schreiben.
4. **Testdaten nach Tests zurücksetzen** — vorher prüfen, ob ein Wert wirklich
   vom Test stammt und nicht von Kevin/Malin echt eingetragen wurde.
5. **Zugang je Person, nie Rückfall auf „kevin“:** Jede Route liest die Person aus der Sitzung
   (`personStreng`/`personAus`); Werkzeuge ohne Person lehnen ab (`KEINE_PERSON`). Dienstaufrufe nur über
   `istDienst(req)` (`lib/zugang/dienst.ts`, konstante Zeit); Inhaber-Dinge über `nurInhaber`. Jarvis-Aufträge,
   Protokoll und Stapel gehören der Person, die sie ausgelöst hat. Die Sitzung ist
   `<speicher>.<ablauf>.<stand>.<signatur>` — `stand` = Fingerabdruck des Passwort-Salzes; die Middleware
   prüft ihn über `/api/konto/stand` (Dienstweg, `lib/zugang/stand-pruefung.ts`, Cache 60 s). Passwort
   ändern → `mitSitzung(frisch)` zurückgeben, damit das eigene Gerät drin bleibt.
6. **Fremder Text ist Daten:** Alles, was Text Dritter tragen kann (Mails, Web, Kontaktnotizen, Bank-
   Verwendungszwecke, Notizen, Gedächtnis, Agentenläufe — Liste in `lib/jarvis/fremd.ts`), läuft durch
   `fremd()`; danach werden schreibende Werkzeuge nur vorgeschlagen. Brain-Blöcke stehen in `<daten>`.
   Keine echten Namen Dritter im Code oder in `public/` (Klickdummys liegen in `prototype/`).
7. **Interne Hops tragen die Person:** Jeder `fetch` auf eine eigene Route mit `x-make-key` gibt
   `x-make-person` mit (aus `personAus(req)` bzw. dem Lauf) — ohne Person gilt der Aufruf als Systemlauf
   des Takts. Neue Routen mit Modellaufruf: `modellSchranke(req)` zuerst; große Bodies: `zuGross(req, n)`.
   Inhaber-Dinge (`nurInhaber`): Mac-Postfach/-Kontakte, Whoop/OAuth, Agenten-Regler, Postfach-Spiegel.
8. **Zweiter Faktor** (`lib/zugang/totp.ts`, RFC 6238, Route `/api/konto/zwei-faktor`): Konto-Feld
   `zweiterFaktor` (Geheimnis, letzte Stufe, Wiederherstellungs-Hashes) — nie in Antworten (`oeffentlich()`
   liefert nur `zweiterFaktorAn`). Anmelden: Passwort → `{ zweiterFaktor: true }` → Passwort + `code`.
   Cookie heißt in Produktion `__Host-make-os-sitzung` (SITZUNG_COOKIE), Server-Admin: `ssh make@… sudo`.
9. **Bestände verschlüsselt** (`lib/store/local-db.ts`): mit `MAKE_OS_DATEN_SCHLUESSEL` liegt auf der Platte
   nur die Hülle `{ __verschluesselt: 1, iv, tag, daten }`; Lesen ohne/mit falschem Schlüssel wirft (nie null).
   Wer `.data`-Dateien direkt liest, muss `entschluesseln()` nutzen. Umstellen/zurück:
   `scripts/daten-verschluesselung.mjs`. Tests biegen den Ordner mit `MAKE_OS_DATEN_DIR` um.

## Design & Produkt
- Design-Sprache: Klar·DARK — Token in `lib/make-one/os-data.ts` (THEME),
  Petrol `#21B5AA` als Akzent. Motion-Sprache in `app/globals.css`.
- **Keine Untertitel/Hinweise hinter Namen** — Namen stehen allein.
- Startseite heißt „Dashboard". Interne Navigation immer `next/link`, nie `<a>`.
- Charts: die drei Teals (health/planning/finance) nie gemeinsam als Serien —
  Finanzen im Chart = Kupfer `#DE9E63`.

## Live-Betrieb (seit 25.09.2026)
- **Server:** Hetzner, `https://2-28-108-162.sslip.io` (IP 2.28.108.162, Admin `ssh make@…` + `sudo` — root-Login ist seit 26.09. aus,
  App-Nutzer `make`, Ordner `/srv/make-os/{app,daten,vault,sicherungen}`, Docker Compose:
  app · arbeiter · caddy). Repos: `KevinDieckmann/make-os`, `KevinDieckmann/make-vault` (privat).
- **Daten liegen NUR auf dem Server.** `deploy/daten-hochladen.sh` nie wieder ausführen
  (überschriebe den Server mit der alten Mac-Kopie). Lokal nur `start.sh --entwicklung`;
  der Marker `.data/umgezogen.json` lässt `start.sh` sonst den Server öffnen.
- **Zwei Stände (seit 25.09., Kevin):** gebaut wird auf `entwicklung`, online ist `main`.
  Nichts einzeln hochladen — Updates werden gesammelt und geplant (`UPDATES.md`: Liste,
  Checkliste, offene Einmal-Schritte). Nur ein Push auf `main` rollt aus.
- **Updates:** commit → `git push` (macht Kevin) → GitHub Action (tsc, vitest, lint) →
  Ausrollen über einen Schlüssel, der auf dem Server nur `git pull && docker compose up
  -d --build` darf (authorized_keys `command=…,restrict`, fester Host-Fingerabdruck im
  Workflow). Ausrollen dauert ~5 Min., die alte Version läuft solange weiter.
- **Härtung:** `deploy/server-haerten.sh` (SSH nur Schlüssel, fail2ban, ufw, Auto-Updates
  mit Reboot 04:30, Docker-Log-Grenzen, sysctl), Login-/Code-Drossel (`lib/zugang/drossel.ts`),
  Sicherheits-Header (`deploy/caddy/Caddyfile`), Schriften selbst mitgeliefert (`app/schriften`).
- **Sicherung:** nachts 03:15 verschlüsselt auf dem Server (14 Tage; Passwort hat Kevin)
  und Hetzner-Backups (aktiv seit 25.09., 7 tägliche Abbilder außerhalb des Servers).

## Bauplan — so arbeiten Kevin, Malin und Claude (seit 25.09.2026)
- `/os/bauplan` ist ein Board: **Ideen → Bereit → In Arbeit → Zum Testen → Fertig**,
  dazu „Planung“ (Etappen mit Zieldatum). Karten kommen vom Knopf „Idee“ oben auf
  jeder Seite (nimmt die Seite mit), aus dem Board („+ Karte“, mit Bildschirmfoto)
  und von Jarvis (`bauplan_notieren`). Logik: `lib/bauplan/board.ts` (getestet),
  API `app/api/bauplan` (+ `/bild`), Oberfläche `components/os/bauplan/`.
- **Bau-Sessions:** Den Stand vom Server holen (`GET /api/bauplan` → `warteschlange`
  = „Bereit“ von oben, ohne Karten, die auf Kevin warten) und von oben abarbeiten.
  Beim Start `verschieben` nach `arbeit`; fertig gebaut → `abgeben { id, ergebnis,
  testen }` („So testet ihr“ konkret, in Klicks). **Nie selbst nach „Fertig“** —
  das macht nur die Abnahme durch Kevin oder Malin; „Passt noch nicht“ kommt mit
  Kommentar zurück nach „Bereit“ (oben).
- Bilder liegen unter `.data/bauplan-bilder` (auf dem Server in `daten`, mit gesichert).

## Kalender — iCloud direkt (seit 25.09.2026)
- Kopf-Knopf „Kalender“ → `/os/planung/woche` (der Wochenplaner ist der Kalender): Termine
  aus iCloud (anlegen, ziehen = verschieben, ändern, löschen mit Rückfrage), Blöcke, eine
  Ganztags-Zeile (Aufgaben mit Datum, Überfälliges als eine Pille, Apple-Erinnerungen,
  Fristen: Meilensteine, Bauplan-Etappen, Mandate, Zahlungen/Eingänge), Sicht
  Kevin/Malin/Gemeinsam, Ebenen. `/os/kalender` = Kalender-Agent (Konflikte, Vorschläge,
  Zuordnung „welcher Kalender gehört wem“).
- Server spricht CalDAV mit iCloud: `lib/kalender/` (zeit, dav, ics mit ical.js, icloud,
  eintraege, zugang, einstellungen), API `app/api/kalender` (+ `/termin`). Die alten Wege
  (`/api/apple-calendar`, `/termin`, `/create`) laufen auf dem Server über iCloud; der
  Abgleich schreibt `calendar-cache` für alle bisherigen Leser (Heute, Tag, Jarvis, Morgenlauf).
- Zugang: `ICLOUD_APPLE_ID`/`ICLOUD_APP_PASSWORT` (app-spezifisch) NUR in der Server-.env —
  einrichten/trennen mit `deploy/icloud-verbinden.sh <apple-id>` (Kevin, per `ssh -t`; fragt nur das App-Passwort). Zugangsdaten
  gehen nur an *.icloud.com. Nach abgelehnter Anmeldung erst nach 30 Min. neu (Apple sperrt sonst).
- Nie in MAKE OS geändert: Serien und Termine mit Teilnehmern (iCloud würde Einladungen
  verschicken) — die Oberfläche sagt „in Apple ändern“. Neue Termine haben nie Teilnehmer.
- Sehen darf den Kalender nur der Haushalt des Inhabers (+ Dienstweg), kein anderes Konto.
- Apple-Erinnerungen gibt iCloud nicht per CalDAV heraus — die kommen nur, wenn der Mac
  zuliefert (`zulieferer.mjs`); den Kalender vom Mac nimmt der Server nicht mehr an.

## Business-Index (seit 25.09.2026)
- Unsere KSI-Logik mit eigenen Zahlen: Finanzielle Gesundheit 50 · Unternehmer-DNA 30 ·
  Markttraktion 20 (arithmetisch). Nur Struktur + Standard-Kennzahlen übernommen — kein Code,
  keine Daten aus KEMARIS/POINCAP/HubSpot. Plan + Entscheidungen: `BUSINESS_KSI_PLAN.md`.
- `lib/business/` (register · messen · index · speicher), API `app/api/business`, Cockpit
  `/os/business` (Kopf-Ring „Business“; `/os/saeule/business` leitet dorthin).
- **Eine Wahrheit:** Business-Säule des Wachstums-Scores = Business-Index (Gesamt);
  Business-Hälfte der Finanzen = Finanzielle Gesundheit. Neue Business-Kennzahlen gehören ins
  Register, nicht als Einzelfaktor in `performance.ts`.
- Sichten: gesamt · kdc (Consulting) · kdv (KD Ventures); Privates nie. Die Kredite im
  V1-Export (`grundlage.schulden`) sind PRIVAT — nie in Business-Kennzahlen.
- Zugang: Haushalt des Inhabers (`lib/zugang/haushalt-inhaber.ts`, auch für den Kalender).
- Verankert: Fachseiten zeigen ihre Kennzahlen (`IndexStreifen`: Zahlen, Markttraktion,
  Mandate); Jarvis `business_index` (frei) und `monatsabschluss_erfassen` (Freigabe); der
  Head of Finance bekommt `business_index` im Datenpaket und Hinweise bei Rot/fehlendem
  Monatsabschluss (`lib/business/fuer-chef.ts`); Feinjustierung: eigene Schwellen je
  Kennzahl (alle Sichten oder eine Firma), Jahresziele je Firma, Verlauf 90 Tage.

## Business-Modell, Privat-Index, Steuern (seit 25.09.2026, auf `entwicklung`)
- **Alles unter Zahlen** (`components/os/FinanzenView.tsx`): Privat · Business · Steuern · Gesamt ·
  Head of Finance. Business = Cockpit (`BusinessCockpit eingebettet`); `/os/business` leitet um.
- **Gemeinsamer Kern** `lib/kennzahlen/kern.ts` (Punkte, Ampel, Gewichte, Details) — Business-Index
  und Privat-Index rechnen damit. Neue Indizes: Register + Messungen, nie eigene Punkte-Logik.
- **Jede Kennzahl liefert `details`** (2–3 Punkte mit `href`) — alle Links über `lib/wege.ts` (WEG),
  nie Pfade von Hand. Zielseiten lesen den Link: Rechnung `?r=`, Zahlung `?z=`, Planposten `?p=`,
  Woche `?tag=`, Buchungen `?monat=&kat=&q=`, Anker `#abschluss` usw. (`components/os/ziel.ts`).
  Beendete Mandate und geschlossene Deals öffnen sich über den Link auch hinter Filtern.
  `tests/business-modell.test.ts` prüft, dass kein Link ins Leere zeigt.
- **Privat-Index** `lib/privat/` + `/api/privat`: nur der eigene Haushalt (`haushaltVon`), nur
  `einheit: privat`; Rücklage/Schwellen/Verlauf in `privat-index--<haushalt>`. Private Hälfte der
  Finanzen im Wachstums-Score = Privat-Index (veraltet > 45 Tage = Lücke).
- **Steuern** `lib/steuern/` + `/api/steuern`: nur Haushalt des Inhabers. Hinweis, keine
  Steuerberatung — Termine gerechnet (§ 108 AO), Beträge mit offengelegten Annahmen. Aufgaben vor
  Fristen heißen `steuer-<frist>` (private tragen „haushalt“), ohne Betrag im Titel.
- Lokaler Dev-Server: kommen Änderungen an bestehenden Dateien nicht an (alter Stand im Bundle),
  die Vorschau „make-os-entwicklung“ einmal neu starten. Produktionsbau prüfen: `MAKE_OS_DIST=.next-pruefbau
  npx next build`, dann Vorschau „make-os-pruefbau“ (Port 3011, mit CSP) — danach `.next-pruefbau` löschen.
- Next 15.5 (seit 26.09.): `params`/`searchParams`/`cookies()` sind Promises (`await`).

## Gesundheits-Index & Traktions-Index (seit 26.09.2026, auf `entwicklung`)
- **Ein Kern für alle Indizes:** `lib/kennzahlen/kern.ts` (`berechneModell`, `geometrisch` für den
  Traktions-Score) + `lib/kennzahlen/speicher.ts` (Verlauf 400 Tage, Schwellen, `fortschreiben`,
  `speichereSchwelle`, Speichername `^[a-z0-9][a-z0-9-]*$`) + `components/os/kennzahlen/IndexAnsicht.tsx`
  (Ring, Säulen, Kacheln, Fenster, Verlauf). Neue Indizes: Register + Messungen + `IndexAnsicht` — nie eigene
  Punkte-Logik, nie eigene Kachel.
- **Gesundheits-Index** `lib/gesundheit/index.ts` + `speicher.ts`, API `/api/gesundheit/index` (nur wer sehen
  darf: `darfGesundheitSehen`), Speicher `gesundheit-index--<person>`; Gesundheits-Säule des Wachstums-Scores =
  dieser Index (`lib/performance.ts`); Jarvis `gesundheits_index` (frei, nur eigene Person oder geteilt).
  Tagebücher (Haut, Streak) zählen nur, wenn geführt (`kennzahlenFuer`).
- **Traktions-Index** `lib/crm/traktion-index.ts` (Kennzahlen der Welten → Kern, Sales 50 · Marketing 40 ·
  Event 10 geometrisch, Grundlage Gewicht 0), Speicher `traktion-index`, API `/api/crm/traktion`
  (GET `index`/`indexVerlauf`, POST `{schwelle}`); `alsTraktion()` liefert die alte Form für Scoreboard und
  Business-Index — eine Zahl überall.
- **Keine toten Stellen:** Wo eine Aufgabe entsteht, steht ihr Link (`WEG.aufgabe`); Kontostände werden nur
  unter Liquidität gepflegt; Controlling-Ist kommt aus `business-abschluesse`; bezahlte Rechnung → Buchung
  `bu-re-<id>` (`rechnungId`), Rechnung trägt `mandatId`. Umleitungen in `next.config.mjs` nur für Adressen,
  die es nicht mehr gibt — nie für Seiten, auf die noch verlinkt wird (Journal, Ritual).

## Technik
- TypeScript strikt: vor jedem Commit `npx tsc --noEmit` — null Fehler.
- Node liegt bei Kevin unter `~/.local/node22/bin` (nicht im PATH). Server
  startet über `./start.sh` bzw. `.claude/launch.json` — nie zusätzlich per
  Bash, wenn schon einer auf 3001 läuft.
- **Schneller Modus (seit 25.09.2026, Kevin: „Ladegeschwindigkeit“):** `start.sh`
  läuft als Produktion (`next start`, Bau in `.next-prod`, `MAKE_OS_DIST`) und
  baut vorher selbst neu, wenn sich Code seit dem letzten Bau geändert hat
  (~70 s, Log `.data/bau.log`; scheitert der Bau → Entwicklungsmodus). Nach
  Code-Änderungen also die Vorschau **make-os neu starten**. Für schnelles
  Iterieren: Vorschau **make-os-entwicklung** (`start.sh --entwicklung`, `.next`).
  Nie in `.next-prod` bauen, während `next start` daraus läuft.
  Gemessen: Kontaktliste 15–16 s (Entwicklung) → 0,4–0,6 s (Produktion).
- Jede GET-Route trägt `export const dynamic = 'force-dynamic'` — sonst friert
  `next build` sie ein (Test `schnittstellen-frisch`).
- Große Abfragen (Kontakte, CRM-Bestand, Leads) über `lib/http/json-antwort.ts`:
  gzip ab 16 KB und ETag aus `speicherStand()` → der 20-s-Abgleich bekommt 304,
  wenn sich nichts geändert hat (Client: `holeMitStand` in `components/os/crm/daten.ts`).
- Takt: nach Fehlschlägen pausiert ein Auftrag 5 · 3^(n−1) min, höchstens 3 h
  (`wartenNachFehler`, lib/jarvis/takt.ts) — nie wieder Minuten-Schleifen.
  Nur ein Arbeiter je MAKE OS (`.data/worker.pid`).
- Stores: JSON-Dateien unter `.data/` via `lib/store/local-db.ts`
  (loadJson/updateJson). API-Gate: `x-make-key`-Header (MAKE_OS_KEY).
- `route.ts` darf keine Extra-Exporte tragen (Next) — geteilte Typen in `lib/`.
- Seiteneffekte nie im setState-Updater (StrictMode führt doppelt aus).
- KI-Aufrufe über `lib/anthropic.ts` (askText/askJson) — nie direkt.
- `main` bleibt immer lauffähig: Feature-Branches, kleine Commits, Merge nach
  kurzem Review.

## Doku
- **Tiefe Akzente (seit 25.09.2026, Kevin: „nicht diese Neonfarben, aber nicht platt — die
  Akzente sind wichtig“):** Vorbild ist das Kürzel in der Kontakt-Akte. Große Farbträger
  (Ringe, Balken, Kürzel, Hauptknöpfe) nehmen das Rezept `TIEF` aus design.ts: kräftige
  Farbe mit Tiefe (Verlauf in den tieferen Ton `TIEF.tiefer`/`TIEF.verlauf`), getönte
  Fläche (`TIEF.flaeche`), halbtransparente Kontur (`TIEF.rand`), weicher Schein
  (`TIEF.schein`/`svgSchein`) — nie Vollfarbe mit Leuchtkranz. Zahlen in Ringen bleiben
  WEISS. Hauptknopf = `TIEF.knopf(farbe)`. Leuchtkränze höchstens mit Alpha 33/40.
- **Schlanke, lebendige Oberfläche (seit 23./24.09.2026):** neue Seiten nur mit
  den Bauteilen aus `components/os/schlank.tsx` (Seite, Karte, Ring, Zahl,
  Balken, Chip, Zeile, Haken, Segmente) und den Leuchtfarben `LEUCHT` aus
  design.ts — Karten mit Tiefe, Glow, hochzählende Zahlen, gestaffeltes
  Erscheinen; eine Ebene, nie eine Null, Farbe bedeutet Zustand. Alle Einträge der
  Leiste (Heute · Wachstum · Gesundheit · Inbox · Aufgaben · Zahlen · Kontakte ·
  Jarvis · System) sind umgebaut; Anmeldung führt zu Heute, Jarvis ist kein
  Vorspann mehr. Der **Wachstums-Score** steht als Kopf über jeder Seite
  (`WachstumsKopf`) — der Score, auf den wir hinarbeiten; sechs Säulen
  (Gesundheit 35 · Business 20 · Finanzen 15 · Planung 10 · Beziehung 10 ·
  Agenten 10, Regel in `lib/agenten-score.ts`), jeder Ring ein Sprung auf
  seine Seite. Seit 24.09. laufen ALLE Seiten und Mitläufer auf diesen Bausteinen; kein
  Bauteil unter `components/os` nutzt mehr `THEME`. ESLint muss grün bleiben
  (`npx next lint`), sonst bricht der Produktions-Build. Breite Seiten teilen
  sich mit `Spalten`/`Spalte`/`Raster` auf (ab 1180 px nebeneinander); keine
  Seite bleibt eine schmale Spalte in der Mitte.
- **Whoop-Export:** `lib/whoop-export.ts` + `/api/import/whoop` (ZIP, CSV oder
  neuester Export aus ~/Downloads, je Person). Knopf unter Gesundheit und
  Verbindungen. Neue Seiten: nie THEME, nie
  Rahmen-Kästen, nie Schrift unter 11, nie eine Null. Alte Ansichten liegen unter
  `/os/uebersicht`, `/os/aufgaben/board` und `/os/inbox/voll`.
- **Haushaltsfinanzen (24.09.2026): Malins MAKE.ORGA zieht nach MAKE OS.**
  Zahlen = Privat | Business | Gesamt. Logik in `lib/finanzen/haushalt/`
  (Cent, EINE Einordnung `einordnung.ts`, Monate über `monat.ts` — nie
  `new Date(...).toISOString()` für Monate). Zugriff nur über
  `haushaltVon(req)` (Konto.haushalt, setzt nur der Inhaber; kein Rückfall
  auf „kevin“). Privat zählt in keiner Business-Rechnung
  (`istPrivatPosten`/`nurBusiness` in `liquiditaet.ts`). Jarvis: Haushalt NUR
  über `blockHaushalt` in Gespräch/Morgen/Empfang, nie in `gatherBrain`.
  Test-Haushalt „test“ für Fotos, echte Prüfdaten nur in `.data/pruefdaten/`.
  Umzug: `app/api/haushalt/umzug`, Einfrieren: `docs/make-orga/`.
- **Head of Finance (24.09.2026): der Finanzagent auf allem.** `lib/finanzen/chef/`:
  `finanzbild.ts` rechnet ALLES deterministisch (Business, Haushalt nur mit
  Zugang, Brücke, Steuertermine, Hinweise); das Modell ordnet nur ein
  (`prompt.ts`, 5 Modi, JSON-Schema). `pruefer.ts` prüft jede Zahl, Quelle,
  Frist + Vollzug/Anlageprodukte → eine Korrekturrunde. Er bewegt nie Geld:
  Vorschläge → Freigabe-Liste (`stand.ts`, Dedup) → angenommen = Aufgabe
  (privat ohne Beträge, Tag „haushalt“). Takt über `plan.ts`/`takt.ts`, ein Lauf
  je Haushalt gleichzeitig; Haushalts-Ergebnisse in Warteschlange/Agenten-Log
  nur als Zähler. Speicher: `finanzchef` (Business) · `haushalt-chef--<h>`.
- **Navigation (24.09.2026, Kevins Vorgabe):** links nur Jarvis · Brain (Wissen) ·
  Markttraktion · Fokus · Aufgaben (`lib/make-one/navigation.ts`, Test `navigation.test.ts`);
  alles andere oben im `WachstumsKopf` (Heute, Inbox, Säulen-Ringe). `/os/fokus`
  ist eine eigene Seite (Fokus je Horizont, Tagesform, Regler).
- **Familie & Partnerschaft (24.09.2026):** `/os/familie`, Logik `lib/familie/`,
  Speicher `familie--<haushalt>` nur über `haushaltVon`. Gemessen wird der
  Pflege-Rhythmus des PAARES (28 Tage, Gewichte in `logik.ts`), nie eine Person,
  nie Gefühle; Ausnahmezeit pausiert. „nur-ich“-Einträge und ungeteilte
  Reparatur-Reflexionen sieht und ändert nur, wer sie schrieb (serverseitig
  erzwungen). Säule „Familie & Partnerschaft“ im Score = Pflege-Rhythmus.
  Konzept: `docs/konzepte/familie-und-partnerschaft.md`.
- **Markttraktion (25.09.2026, vorher „CRM“): alles zur Kundengewinnung unter
  `/os/markttraktion`** (`/os/crm` leitet mit allen Parametern um; Adressen und
  alte Bereiche in `lib/crm/adresse.ts`). Aufbau: **Überblick** (Traction-Score,
  drei Heads, Übergaben, Befunde — `/api/crm/traktion`) · **Sales** (Heute/Power
  Hour · Pipeline · Kunden · Kampagnen) · **Marketing** · **Event** · dazu die
  Grundlage Kontakte · Firmen · Stammdaten. **Traction-Score** (`lib/crm/traktion.ts`):
  Gewichte aus dem KEMARIS-Konzept (Sichtbarkeit 15, Marketing 25, Vertrieb 30,
  Events 10, Conversions 20) → Sales 50 · Marketing 40 · Event 10; Punkte aus der
  Ampel, grau zählt nicht, gesamt = gewichtetes geometrisches Mittel, fehlende
  Welten → „vorläufig“; Grundlage (Datenreife, Art. 14, Ansprechbar) zählt NICHT.
  Er ist der Faktor „Markttraktion“ im Business-Score. Im Code heißt die
  Datenschicht weiter `crm` (lib/crm, /api/crm, Speicher `crm`) — das ist die
  Kartei darunter, nicht der Name; sichtbar und für Jarvis heißt es Markttraktion. Personen im Speicher
  `kontakte` (Modell `lib/make-one/crm.ts`), alles daran im Speicher `crm`
  (`lib/crm/`: pipeline, recht, heute, kunden, events, dubletten, umzug).
  Grundkonzept aus der Markttraktion (KEMARIS Operations) — **Daten nur eigene**
  (Masterdatei `~/Desktop/CRM Leadordner`, Brain); nie Daten aus Operations/HubSpot
  holen, das Adressbuch der Kontakte-App bleibt draußen. **Kanal-Ampel
  (`lib/crm/recht.ts`) gilt für jede Karte, jeden Entwurf, jedes Agentenpaket**:
  LinkedIn-Nachricht = elektronische Post, Kaltanruf nur mit Anlass, Werbesperre
  sperrt alles — keine Rechtsberatung, einmal anwaltlich gegenlesen. Kunden
  = Mandate (`kundenAusMandaten` für Score/Jarvis); Mandat → Liquiplan nur als
  Vorschlag (`/api/crm/liquiplan`), nie automatisch. **Firmen** sind eigene
  Stammdaten (`crm.firmen`, Kontakt.firmaId, Abgleich `lib/crm/abgleich.ts` nach
  jedem Import — füllt nur leere Felder). **Stammdaten-Bereich**: Selbstprüfung,
  Pflichtangaben (Herkunft Art. 14 / Rechtsgrundlage Art. 6 nur als Vorschlag,
  Übernahme per Klick), Betroffenenanträge, Verzeichnis Art. 30, Export.
  Konzept: `docs/konzepte/crm-sales-marketing-events.md`.
- **Überall sauber zurück (25.09.2026):** `components/os/Verlauf.tsx` (im Wurzel-Layout):
  jeder Verlaufseintrag trägt seine Tiefe, die Scrollposition in `<main>` wird je
  Eintrag gemerkt und bei Zurück/Vor wiederhergestellt. **Regel:** Ort wechseln
  (Bereich, Reiter, etwas öffnen) = `router.push`; nur Gleichrangiges tauschen =
  `replace`. Zurück-Knöpfe: `useZurueck()`/`ZurueckKnopf` (echter Schritt, sonst die
  übergeordnete Seite). Offene Details im Link: `useLinkAuswahl('k'|'offen')`
  (Deals, Mandate, Kampagnen, Leads, Events, Aufgaben, Inbox, Kartei). Nach oben nur
  über `nachOben()`. Brain-Notizen über `?n=` mit Verlauf. Aufgaben zeigen ihre
  Beschreibung, `/os/…`-Pfade darin werden Links (`TextMitLinks`).
- **LinkedIn-Flow (25.09.2026):** `lib/crm/netzwerk.ts` (+ `netzwerk-form.ts`),
  `/api/crm/netzwerk`, `components/os/crm/Vernetzen.tsx`. Stand je Profil an der
  Person (`Kontakt.netzwerk[kevin|malin]`: angefragt → vernetzt → geschrieben),
  Vernetzen-Runde (Kontakte › Vernetzen-Runde, `a=runde-vernetzen&k=kp-…`):
  anreichern (Suchlink/Profil einfügen) → anfragen (Tagesportion, Notiz) →
  schreiben (Text der Kampagne) → nachfassen (Ja = Einwilligung „social“ mit Wortlaut).
  Texte **modular je Kampagne** (Playbook `vernetzen`, `Kampagne.vernetzen`, Vorlagen mit
  Rechts-Ampel). LinkedIn-Export (Connections.csv) gleicht nur mit vorhandenen
  Kontakten ab und markiert Annahmen. Head of Marketing Modus `netzwerk` (werktags ab
  8, reines Regelwerk, Art `vernetzen_runde`). MAKE OS versendet nichts.
- **Produkte & Mandate (25.09.2026, Kevin: „Mandaten-Abteil links unter Aufgaben“):** `/os/mandate`
  (`components/os/mandate/`, Regeln `lib/crm/produkte.ts`). Reiter Mandate (die frühere
  Kunden-Ansicht, `MandateUebersicht` in `crm/Kunden.tsx`, jetzt mit Produkt + Phase) und
  Produkte (Katalog = Liste `leistungen`, nach Linien, Zahlen je Produkt, Ablauf in Phasen,
  Unterlagen als https-/Brain-Links). Sales › 3 · Kunden ist nur noch `KundenKurz` mit Sprung
  dorthin; Links: `mandateLink(s, k)` in `lib/crm/adresse.ts`.
- **Kontaktakte (25.09.2026, Kevin: „die ganze Matrix … auf einem Bild“):**
  Karteikarte oben rechts „Akte öffnen ⤢“ → `/os/markttraktion?s=kontakte&a=akte&k=<id>`
  (`components/os/crm/Akte.tsx`, Regeln `lib/crm/akte.ts`). Kopf: Zurück (Knopf, Esc,
  Browser) · Name, Kanäle · sechs Kennzahlen (letzter Kontakt, nächster Schritt,
  Takt, Gespräche, Deals, Vollständigkeit). Spalten: Stammdaten (die **Matrix**: jedes
  Feld der Masterdatei, antippen zum Bearbeiten; Firmenfelder aus dem Firmeneintrag,
  sonst aus dem Import) · Aktivitäten (ganzer Verlauf) · Sales, Beziehung,
  Verbindungen (Kollegen, Deals der Firma, Events, Kampagnen, Beiträge, Power Hour,
  Anträge), Recht. Breit 3, Laptop 2, Handy 1 Spalte. Karteikarte und Akte teilen
  die Bausteine in `components/os/crm/kontakt-teile.tsx`. Gescrollt wird in `<main>`,
  nicht im Fenster.
- **Sales in drei Ebenen (25.09.2026, Kevin: „klare Ebenen“):** `lib/crm/leads.ts`,
  `/api/crm/lead`, `components/os/crm/Leads.tsx`. **Ebene 1 Leads** = Firma
  (Account; ohne Firma die Person), `Firma.lead` / `Kontakt.lead` (`Lead`,
  gesäubert in `lib/crm/lead-form.ts`): Status neu → kontaktiert → im Gespräch
  → Qualifizierung → **SQL** (+ kein Fit, ruht, Kunde), sechs Kernfragen;
  **SQL = Schmerz ja + Entscheider ja + (Budget ja oder Zeitpunkt ja)**. Ohne
  gesetzten Status wird er aus den Personen abgeleitet. „Zum SQL → Deal
  anlegen“ (Pflicht: nächster Schritt mit Datum) erzeugt den Deal, Kernfragen
  wandern mit. **Ebene 2 Deals** = Chancen, Pipeline ab Stufe „SQL“ (id bleibt
  `qualifiziert`); sichtbar heißt es überall „Deal“. Deal gewonnen/verloren
  spiegelt sich im Lead (Kunde/ruht). **Ebene 3 Kunden**: gewonnener Deal →
  „Mandat anlegen“ (Firma → Kunde, Personen → Lebensphase Kunde). Sales-Reiter:
  Heute · 1 Leads · 2 Deals · 3 Kunden · Kampagnen, oben der **Trichter** mit
  Gespräch→SQL und SQL→gewonnen. Verbunden: LeadBlock in Personen-/Firmenkarte,
  Qualifizierungs-Runde (ersetzt Chancen-Runde), „+ Gespräch“ legt Deals nur über
  SQL an, Kampagnen-„Interesse“ → Lead in Qualifizierung, Head of Sales Modus
  `lead_review` (montags), KPI „Neue SQL · 30 Tage“, „Für dich“ (SQL-bereit,
  in Qualifizierung), Jarvis `chance_anlegen` setzt den Lead auf SQL. Head-Block
  in allen Ansichten standardmäßig zugeklappt.
- **Markttraktion in der Praxis (25.09.2026 abends):** Erfassen ohne Reibung —
  Kanal-Chips sind Links (tel:/mailto:/LinkedIn, nur wenn die Ampel nicht rot
  ist), „Anrufen“ je Power-Hour-Karte, „Wie lief's?“ nach Kalenderterminen
  (`lib/crm/erfassen.ts nachbereitung`), Einwilligung im Gespräch mit Wortlaut
  (überschreibt keine vorhandene Rechtsgrundlage), „+ Gespräch festhalten“ von
  überall (`SchnellErfassen.tsx`), Jarvis `notiere_kontakt` mit Ergebnis/Bedarf/
  nächstem Schritt. **Geführte Runden** (`lib/crm/runden.ts`, `Runden.tsx`,
  `?s=kontakte&a=runde-kreis|runde-chancen`): Kreis A–D + Beziehung/Anrede;
  Chancen für alle im Gespräch — **Wert startet leer**, Katalogpreis nur als
  Vorschlag (nie erfundene Pipeline). **Rhythmus** (`lib/crm/scoreboard.ts`):
  Traction-Verlauf (`traktion-verlauf`), Wochen-Scoreboard 8 KW mit Zielen je
  Woche und je Person, Morgen-Nachricht werktags ab 7:30 und Freitags-Scoreboard
  per Telegram (Agent `markttraktion`, Riegel `markttraktion-takt`, nur mit
  Token + Kopplung). **Visitenkarte → Kontakt** (`/api/crm/visitenkarte`, Haiku,
  Bild wird nicht gespeichert; Herkunft „selbst“/„veranstaltung“, KEINE
  Einwilligung), auch am Einlass. Antworten der Aktivitäts-Route filtern
  fremde private Notizen.
- **Heads auf Spitzenniveau (25.09.2026, Recherche Best Practice der besten Agenten):**
  fester Ablauf statt freiem Agenten (`lib/heads/lauf.ts`): volles Datenpaket
  (`paket.ts`: Fachdaten + **Grundlauf** + Lernstand + Gedächtnis + Team +
  Übergaben + Stimme) → **Grundlauf** (`grundlauf.ts`, Regelwerk ohne Modell —
  bei leerem Guthaben/Ausfall IST er das Ergebnis) → Modell übernimmt/verwirft
  mit Grund/ergänzt (Evaluator-Optimizer) → Prüfer (IDs, Kanal § 7 UWG, Vollzug,
  Zahlen, **Qualitätsrubrik**: Frist, Beleg, Anrede Sie/Du, Platzhalter,
  ≤ 90 Wörter; „hoch“ nur mit frischem **Signal** ≤ 14 Tage oder Frist/Zusage/
  Pflicht) → eine Korrekturrunde → dringendes Regelwerk kommt zurück
  (`pflichtZurueck`) → **Belege** je Vorschlag (`belege.ts`) → „fuer“ →
  speichern → **Autonomie** (`autonomie.ts`, Kevin: interne Kleinigkeiten
  selbst: nächster Schritt an der Person nur wenn leer, sonst Aufgabe; nie
  Entwurf/Kampagne/Merksatz; nicht in Power Hour/Nachfassen; Rücknahme = Ablehnung).
  **Lernen** (`lernen.ts`): Ablehnen mit Grund, Annahmequote je Art (ohne
  Selbst-Übernommenes), Wirkungsleiter Aktivität→Antwort→Termin→Chance,
  Änderungsgrad der Entwürfe, Beispiele nach Modus, **Gedächtnis** (Merksätze).
  **Modell:** Reviews (deal/kunden/kampagne/wochen/monat/wirkung) Opus 5.5 mit
  effort high, sonst Sonnet 5 medium; System-Text > 1.024 Token (Cache), zweiter
  Cache-Punkt hinter dem Datenpaket, Datenblock `<daten_<zufall>>`. Verbrauch inkl.
  Cache je Lauf. **Evals** (`eval.ts`, `/api/heads/eval`): jeder Lauf legt den Fall
  in `.data/heads-replay-<head>` ab; GET = offline bewerten, POST = live k-mal
  (pass^k) — vor jeder Prompt-/Modelländerung. Takt auch ohne Schlüssel
  (Regelwerk), Power Hour je Team-Person mit Konto. Budget-Limit: Kevin „später“.
- **Markttraktion zu zweit (25.09.2026, Kevins Entscheidungen):** `lib/crm/team.ts`.
  **Verantwortlich je Welt:** Sales Kevin (Malin macht auch Sales), Marketing +
  Event Malin. **Zuständig je Eintrag:** kevin | malin | beide (Kontakt `besitzer`
  = „Hält die Beziehung“, Chance `besitzer`, sonst `zustaendig`); ohne Eintrag
  gilt die/der Verantwortliche. Beide sehen alles — **nur die private Notiz sieht
  allein, wer sie schrieb** (`privatNotizVon`, GET /api/state/kontakte filtert,
  `kontaktVereinen(neu, alt, person)` schützt sie). **Power Hour je Person**
  (`karteGehoert`: Chance → Mandat → Kampagne → Einladung → Beziehung), damit
  nie zwei dieselbe Person anrufen. **Teil-Änderungen** (`op: 'teil'`,
  `api.teil`) statt ganzer Einträge, `geaendertVon` stempelt der Server.
  **Übergabe** (`/api/crm/uebergabe`): Zuständigkeit + Verlauf + nächster
  Schritt + Aufgabe für die andere Person. Head-Vorschläge gehen an die
  zuständige Person. Überblick: „Für dich“ + „Zuletzt im Team“. Anwesenheit
  meldet in der Markttraktion auch die Ansicht (`k=` → „Malin ist gerade hier“).
  Beiträge/Newsletter mit Stimme + Freigabe (`Freigabe`-Typ), Events mit
  Checklisten-„wer“ und Gast-„lädt ein“ (`einladenDurch`).
- **Markttraktion verbunden (Nacht zum 25.09.2026, damals „CRM“):**
  - **Einstiege:** Kontakte und Firmen sind eigene Einstiege. Die Schnellsuche (⌘K) findet Personen, Firmen, Chancen und Mandate.
  - **Signale:** `lib/crm/signale.ts` übernimmt Mail und Kalender, aber nur aus den GESCHÄFTLICHEN Quellen. Das private Postfach und private Kalender bleiben draußen. Übernommen werden nur Betreff und Titel, und Funktionspostfächer zählen nicht.
  - **Zahlung:** Der Health-Faktor Zahlung kommt aus den Rechnungen im Finanzplan.
  - **Anbindung:** Jarvis-Werkzeuge `crm_lage` und `chance_anlegen`. Der Head of Finance sieht MRR und die gewichtete Pipeline (nie im Basisplan).
  - **Kampagnen** (`lib/crm/kampagnen.ts`):
    - acht Playbooks mit Begründung und Rechtshinweis
    - Kundenprofil und „Kunden wie unsere besten“ (nur mit gemeinsamer Branche)
    - Head of Sales und Head of Marketing planen Kampagnen im Modus `kampagne`; angenommen wird daraus ein Entwurf
    - offene Personen aktiver Kampagnen stehen in der Power Hour
  - **Marketing:** Segmente (`lib/crm/segmente.ts`), Redaktionsplan, Newsletter (nur Double-Opt-in), Positionierung.
  - **Events:** Vorlagen, Gästemischung, Checkliste → Aufgaben, Budget, Check-in, Nachfassen, Kalenderdatei.
  - **Grenze:** MAKE OS versendet nichts.
- **Die drei Heads (24.09.2026):** Sales, Marketing, Event in `lib/heads/`
  (Muster wie Head of Finance: Code rechnet das Datenpaket, Prüfer streicht
  erfundene IDs, Sperren und unzulässige Kanäle, Vollzug/unbelegte Zahlen →
  Korrekturrunde; Freigabe-Liste `head-<id>`; angenommen = nächster Schritt an
  der Person oder Aufgabe). Nie `privatNotiz`, nie gesperrte Personen ins Paket.
  Takt in `lib/heads/takt.ts`, eingehängt in `lib/jarvis/takt.ts`.
- **Eine Kasse (24.09.2026).** Business-Kasse = Summe der Firmenkonten
  (`geschaeftsKasse`/`mitKasse` in `finance-data.ts`); `finance.cash` nur
  Rückfall. Rest-Monate ab heute (Berlin). Keine zweite Runway-Formel bauen.
- **Selbstaufrufe nie über die Anfrage-Adresse (24.09.2026).** Routen, die
  andere Routen mit `x-make-key` aufrufen, nehmen `innenAdresse(req)` aus
  `lib/innen.ts` — nie `new URL(req.url).origin` (Vorbau Tailscale/Caddy,
  Schlüssel an fremden Host). Einladungslinks: `MAKE_OS_ADRESSE`.
- **Obsidian ist Wissensbank Nummer eins (24.09.2026).** `lib/jarvis/vault.ts`
  liest `~/Desktop/MAKE/Make.Claude` zuerst, dann die iCloud-Doku. Es gelten
  Kevins Regeln aus dem Vault (`AGENTS.md`, `Vertraulichkeitsregeln.md`):
  `scope: privat` nie an Agenten/Hintergrundläufe und nie in Texte nach außen;
  Schreiben nur als Protokoll oder Anhang an `Offene_Fragen_Brain`,
  `Taskmanagement_Brain`, `Jarvis_Log` — Fundament und Quellen nie, im Ordner
  MAKE wird nichts gelöscht. Seite `/os/wissen` mit Chat „Fragen“
  (`lib/jarvis/brain-chat.ts`, nur lesend, antwortet nur aus Notizen mit Quelle),
  Tests `vault-sicht`/`markdown`/`brain-chat`.
- **`PLAN.md` ist der führende Plan (seit 18.09.2026).** Bestand bleibt und
  wird auf Hetzner hochgefahren; Reihenfolge Hochfahren → Aufgaben → CRM →
  Anbindungen → Prozesse. Ein Bereich wird fertig und benutzt, dann der
  nächste. Keine Spielerei — Kevins Ansage. `UMSETZUNGSPLAN.md` ist erledigt.
- **Das Gedächtnis liegt im Obsidian-Vault**, nicht nur im Repo:
  `iCloud/Make Privat ❤️/MAKE OS/05 Wissen/MAKE OS/`. Einstieg dort:
  `MAKE OS — Karte.md`. 21 verlinkte Notizen (07.09.2026) mit dem kompletten
  Weg seit 19.06., allen Entscheidungen samt Begründung, den Fehlern und ihren
  Lehren, der Codelandkarte, dem tragenden Code im Original und Kevins
  Wunschliste. **Vor größeren Umbauten dort nachlesen** — die Begründungen
  stehen nirgends sonst. Jarvis findet die Notizen über `suche_wissen`.
  Achtung: der Vault liegt in iCloud — dort niemals Schlüssel ablegen.
- `BEWEGUNG.md` — die Bewegungssprache: 30 Punkte aus der Recherche vom 07.09.,
  jeweils mit Begründung.
- `ONBOARDING_MALIN.md` — Einstieg für Malin (mitbenutzen + mitbauen).
- `UMSETZUNGSPLAN.md` — Konzept; der lebende Bauplan liegt in der App
  unter `/os/bauplan`.
