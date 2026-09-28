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
- **ZOE-Mentalität, immer:** Wir arbeiten dauerhaft an unserer eigenen
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
   `istDienst(req)` (`lib/zugang/dienst.ts`, konstante Zeit); Inhaber-Dinge über `nurInhaber`. ZOE-Aufträge,
   Protokoll und Stapel gehören der Person, die sie ausgelöst hat. Die Sitzung ist
   `<speicher>.<ablauf>.<stand>.<signatur>` — `stand` = Fingerabdruck des Passwort-Salzes; die Middleware
   prüft ihn über `/api/konto/stand` (Dienstweg, `lib/zugang/stand-pruefung.ts`, Cache 60 s). Passwort
   ändern → `mitSitzung(frisch)` zurückgeben, damit das eigene Gerät drin bleibt.
6. **Fremder Text ist Daten:** Alles, was Text Dritter tragen kann (Mails, Web, Kontaktnotizen, Bank-
   Verwendungszwecke, Notizen, Gedächtnis, Agentenläufe — Liste in `lib/zoe/fremd.ts`), läuft durch
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
10. **Kartei-Zugang & Änderungsprotokoll (28.09., K1):** `/api/state/{kontakte,kunden,prospects,netzwerk,stammdaten,aenderungen}`
   nur über `karteiZugang` (Haushalt des Inhabers; Dienstweg mit Person nur für eine Person dieses Haushalts). Das
   Änderungsprotokoll schreibt nur der Server (`lib/store/aenderungsprotokoll.ts`, Monatsdateien, nur anhängend, nie
   Werte, Kontakt-Kennungen als `c#…`) — neue Schreibwege über `listePatchen`/`aendereCrm` oder `protokolliereBestand`.
   Änderungslisten nie still kürzen (`opsFehler` → 413). Kein SEED mit echten Namen/Beträgen (`tests/repo-sauber.test.ts`).
11. **Team nur aus `team--<haushalt>`, nie im Code (28.09., U4):** Leser holen es über `teamVon`/`teamFuerPerson`/`teamFuerAnfrage`
   (`lib/make-one/team-speicher.ts`) bzw. `useTeam` (`GET/PATCH /api/team`); Prompts bekommen die Namen zur Laufzeit. Kevin und Malin
   kommen aus den Konten. `lib/make-one/team-data.ts` = nur Rollen-Platzhalter als Rückfall (leerer Speicher, Tests).

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
  dazu „Planung“ (Etappen mit Zieldatum). Karten kommen aus „Problem oder Idee
  melden“ in der Leiste unten links zwischen Brain und System (Handy: „Melden“;
  löst `make-idee` aus → Fenster `IdeeErfassen`, Art Fehler · Idee · Wunsch, nimmt
  die Seite mit), aus dem Board („+ Karte“, mit Bildschirmfoto)
  und von ZOE (`bauplan_notieren`). Logik: `lib/bauplan/board.ts` (getestet),
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
  Abgleich schreibt `calendar-cache` für alle bisherigen Leser (Heute, Tag, ZOE, Morgenlauf).
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
  Mandate); ZOE `business_index` (frei) und `monatsabschluss_erfassen` (Freigabe); der
  Head of Finance bekommt `business_index` im Datenpaket und Hinweise bei Rot/fehlendem
  Monatsabschluss (`lib/business/fuer-chef.ts`); Feinjustierung: eigene Schwellen je
  Kennzahl (alle Sichten oder eine Firma), Jahresziele je Firma, Verlauf 90 Tage.

## Business-Modell, Privat-Index, Steuern (seit 25.09.2026, online)
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

## Gesundheits-Index & Traktions-Index (seit 26.09.2026, online)
- **Ein Kern für alle Indizes:** `lib/kennzahlen/kern.ts` (`berechneModell`, `geometrisch` für den
  Traktions-Score) + `lib/kennzahlen/speicher.ts` (Verlauf 400 Tage, Schwellen, `fortschreiben`,
  `speichereSchwelle`, Speichername `^[a-z0-9][a-z0-9-]*$`) + `components/os/kennzahlen/IndexAnsicht.tsx`
  (Ring, Säulen, Kacheln, Fenster, Verlauf). Neue Indizes: Register + Messungen + `IndexAnsicht` — nie eigene
  Punkte-Logik, nie eigene Kachel.
- **Gesundheits-Index** `lib/gesundheit/index.ts` + `speicher.ts`, API `/api/gesundheit/index` (nur wer sehen
  darf: `darfGesundheitSehen`), Speicher `gesundheit-index--<person>`; Gesundheits-Säule des Wachstums-Scores =
  dieser Index (`lib/performance.ts`); ZOE `gesundheits_index` (frei, nur eigene Person oder geteilt).
  Tagebücher (Haut, Streak) zählen nur, wenn geführt (`kennzahlenFuer`).
- **Traktions-Index** `lib/crm/traktion-index.ts` (Kennzahlen der Welten → Kern, Sales 50 · Marketing 40 ·
  Event 10 geometrisch, Grundlage Gewicht 0), Speicher `traktion-index`, API `/api/crm/traktion`
  (GET `index`/`indexVerlauf`, POST `{schwelle}`); `alsTraktion()` liefert die alte Form für Scoreboard und
  Business-Index — eine Zahl überall.
- **Keine toten Stellen:** Wo eine Aufgabe entsteht, steht ihr Link (`WEG.aufgabe`); Kontostände werden nur
  unter Liquidität gepflegt; Controlling-Ist kommt aus `business-abschluesse`; bezahlte Rechnung → Buchung
  `bu-re-<id>` (`rechnungId`), Rechnung trägt `mandatId`. Umleitungen in `next.config.mjs` nur für Adressen,
  die es nicht mehr gibt — nie für Seiten, auf die noch verlinkt wird (Journal, Ritual).

## Sport: Hyrox, Running, Gym, Erholung (27.09., nur lokal)
- `/os/sport` unter Privat › Gesundheit (Kachel „Sport“ auf der Gesundheitsseite, Schnellsuche, `WEG.sport(reiter)`), Reiter `?s=` plan · hyrox · lauf · gym · erholung.
  **Persönlich je Person:** Speicher `speicherFuer('sport', person)`; Route `/api/sport` liest die Person nur aus der Sitzung (`personStreng`, sonst 401), kein `?fuer=`.
- Modell `lib/sport/modell.ts` (rein): `SportStand` (einstieg, ziele, ausgang, woche, planStart, hyrox, laeufe, gym, erholung), `saeubere` (nichts Erfundenes, keine Null),
  Schritte `Op` über `wendeAn` — die Route wendet `PUT { ops }` in EINER `updateJson`-Sperre an; ein ungültiger Schritt lässt den ganzen Stapel liegen (400).
- Rechnung: `pace.ts` (Pace, Zeiten parsen/formatieren, Wochenkilometer, Bestzeiten 5/10/21,1 mit Hochrechnung ≤ 8 %, Riegel), `hyrox.ts` (Stationen mit Anteilen,
  Splits aus Zielzeit, Schwächen, Prognose), `gym.ts` (Bibliothek, Vorlagen, Epley-e1RM, Verlauf, Rekorde), `plan.ts` (Wochenvorschlag je Disziplin, Plan/Ist, Deload alle 4 Wochen),
  `ampel.ts` (Erholungspunkte = Mittel der gemessenen Merkmale, HRV/Puls gegen den 7-Tage-Bezug, Recovery aus Vitalwerten zählt mit). Tests `tests/sport-*.test.ts`.
- Erholung belegt Schlaf/Puls/HRV aus `vitals--<person>` vor (Whoop-Export, Morgen-Check) — nur anzeigen, gespeichert wird erst auf „Speichern“ (`quelle: whoop`).
- Wording: Vorschläge, keine Trainingsberatung (Hinweis auf jeder Karte, die plant). Läufe tragen `quelle` (`hand` | `apple-health` | `strava` | `whoop`) + `externeId`, damit ein Import später andockt.

## Ziele & Planung — Ziele, Meilensteine, Kaskade, Routinen (27.09. abends, nur lokal)
- Ein Bauteil für alle Ebenen Tag · Woche · Monat · Quartal · Jahr: `components/os/planung/ZieleMeilensteine.tsx` (Ziele links,
  Meilensteine rechts, „+ neu“ oben, offen nach Rang, Erledigtes unten scrollend) + `usePlanung.ts` (laden/schreiben) +
  `PfeilRang.tsx` (▲▼, Alt+↑/↓). Horizont-Seiten (`HorizontView`), Wochenplaner und Tagesplanung hängen es nur ein.
- Typen EINMAL in `lib/planung/typen.ts` (Ziel, Meilenstein, Routine, Block); Routen exportieren sie nur weiter. Neue Felder
  additiv, gesäubert im Schreibweg (`lib/planung/ziele.ts`, `routinen.ts`, Meilenstein-Route). Rang: `lib/planung/rang.ts`
  (`sortiertNachRang`, `verschiebe` nur innerhalb der sichtbaren Teilmenge, `naechsterRang`).
- **Kaskade** rein in `lib/planung/kaskade.ts`, läuft im PATCH von `/api/state/ziele` (`{ horizont, ops }`, je Ziel mit Stand, seit 28.09.; PUT nur noch Fokus) in derselben Sperre (fünf Horizonte): Jahres-Zahlenziel →
  Quartal/Monat/Woche/Tag (`abgeleitetVon`, Kennung `<eltern>~<ebene>`, nie doppelt), Jahres-Termin-Ziel → Meilenstein
  `ms~<ziel>`. `angepasst` = nicht mehr nachziehen; Löschen nur nach „lösen“. Neue Ableitungsregeln dort ergänzen, nie in der Ansicht.
- **Einheiten** (nur Business): `lib/planung/einheiten.ts` (Standard Selbstständigkeit · KD Ventures · Kunden), Speicher
  `planung-einheiten--<haushalt>` über `/api/planung/einheiten`. Privat trägt nie eine Einheit.
- **Einheiten-Regel (27.09.):** Business-Einheiten nur aus `lib/einheiten.ts` (Kern: Selbstständigkeit · KD Ventures · MAKE OS UG =
  kdc · kdv · ug) + `lib/planung/einheiten.ts` (Werteliste je Haushalt) — nie eigene Listen oder Schreibweisen.
- **Finanzen: EINE Einheitenliste (28.09.):** `FinanzOrt = 'privat' | kdc | kdv | ug` + `FINANZ_ORTE`/`GESELLSCHAFTEN`/`finanzOrtName`/`finanzOrtAus` (Altwerte)/`firmaAusAngabe` (ZOE) in `lib/einheiten.ts` — Cockpit (Sicht `ug`), Steuern, Baukasten, Privat-Finanzen, Buchungen-`ort`, ZOE, Kontaktakte nutzen nur diese. Selbstständigkeit = eigene Achse; der Rechenkern v3 hat keine kdc-Achse → kdc-Bausteine rechnen über die UG-Kanäle (`kernKanal`, einzige Stelle), Kern-Name `selbststaendigkeit` ↔ kdc nur über `finanzOrtAusKern`/`kernEinheitAus`. Steuern: UG sichtbar, aber ohne Fristen/Schätzung (`UG_NICHT_HINTERLEGT`, `STEUER_FIRMEN` = kdc/kdv). Privat-Finanzen: Dateien ohne Marke `einheiten: 2` sprechen das alte Vokabular (`ug` = KD Management UG = **kdv**!) und werden beim Lesen übersetzt (`einheitenLesen`, `haushaltEinheitAusAlt`), geschrieben wird die neue Fassung; Eingaben über `einheitAus` (neues Vokabular). Summen-Regression: `tests/finanz-einheiten-summen.test.ts`.
- **Aufgaben tragen `einheit`** (nur Business, `types/tasks.ts`): Säuberung im Schreibweg (`aufgabeEinheit` in `lib/aufgaben/einheit.ts`,
  genutzt von `/api/state/tasks` und `/api/tasks/create`; Privat/Ort-privat verwirft). System-Aufgaben mit Deal/Mandat/Produkt dahinter:
  `einheitAusBezug(crm, …)` (Heads), Steuer-Aufgaben `steuerEinheit`; ohne Bezug keine Einheit. Oberfläche: `components/os/aufgaben/Einheit.tsx`
  (`EinheitWahl` = `Wahl` mit `onNeu`, `EinheitFilterPillen`, `EinheitMarke`, `useEinheiten`), Filter/Vorgabe rein (`passtEinheitFilter`,
  `einheitFilterOptionen`, `vorgabeEinheit`, Merker `make-aufgaben-einheit`). ZOE `create_task` nimmt `einheit`. Routinen im Business
  ebenso optional `einheit` (`sauberRoutine`). Tests `tests/aufgaben-einheit.test.ts`.
- **Routinen** (Speicher `routinen`): `space` (fehlt = privat), `owner` (Person oder `beide`, fehlt = beide), `rhythmus`
  (fehlt = täglich) + `naechstesMal`, `rang`; Fälligkeit in `lib/planung/rhythmus.ts` (rein, YYYY-MM-DD, Monatsende geklemmt),
  „heute dran“ je Person in `lib/planung/routinen.ts` (`heuteFaellig`, `sichtbarFuer`). Blöcke (Wochenvorlage je Person) liegen
  als `bloecke` im selben Bestand — geschrieben nur per `PATCH { bloecke: ops }`, nur eigene Blöcke (`personStreng`, sonst 403). Wer Routinen liest, filtert mit `sichtbarFuer(…, person)`.
- Home-Widget `routinen-heute` (Einstellung `space`) in `components/os/flaeche/widgets.tsx`, im `HOME_STANDARD` je Space.
- Tests `tests/planung-*.test.ts`. Sichtprüfung nur mit Wegwerfkonto; Ziele/Meilensteine/Routinen sind GETEILTE Bestände —
  Schreibtests nur über `fuer: 'ich'` (persönlicher Ziele-Speicher), nie in `ziele`/`meilensteine`/`routinen` selbst.

## Ernährung & Einkauf zu zweit (seit 26.09.2026, online)
- Modell `lib/ernaehrung/modell.ts` (rein): Profile je Person (Konto = nur selbst, Gast = Haushalt), Stammliste
  (bevorzugte Lebensmittel + Hinweis), Vorrat, Gerichte (Rezepte), Plan + `planGerichte`, Einkauf mit Menge/Kategorie/
  für/von/Quelle. Helfer: `kategorieRaten`, `postenParsen`, `gleichesLebensmittel`, `fehlendeZutaten`, `warenkorbText`,
  `wendeAn` (PATCH-Schritte). Tests `tests/ernaehrung.test.ts`.
- Route `/api/state/ernaehrung`: GET (+ `ich`, `personen`, `budget`), **PATCH `{ ops }`** für alle Änderungen (kein
  Voll-Stand zurückschreiben — zu zweit am Handy), PUT nur Altweg. `/api/ernaehrung/vorschlag` (Woche für alle Profile,
  mit Rezepten, Vorrat abgezogen), `/api/ernaehrung/rezept` (ein Rezept, hängt am Plan-Feld). Nur Haushalt des Inhabers.
- Ansicht `components/os/ErnaehrungView.tsx` (in Gesundheit → Ernährung eingebettet); ZOE `einkauf_setzen` (frei).
- Gerichte-Bibliothek „Unsere Gerichte“ (26.09.): `Gericht` hat `favorit` + `notiz`; Helfer `gerichteFiltern`, `tagsHaeufig`,
  `imPlan`, `gerichtZuName`, `zutatenAusText`, `schritteAusText`. `/api/ernaehrung/rezept` nimmt auch `beschreibung`
  (Wunsch) oder `text` (eingefügtes Rezept, als `fremd()`); `/vorschlag` listet gespeicherte Gerichte (★ zuerst) und
  legt für sie kein neues Rezept an. Deep-Link `WEG.gericht(id)` → `?s=ernaehrung&g=<id>`.

## Flächen & Widgets (seit 26.09.2026, online)
- Kevins Ansage: alle Karten-Seiten je Person gestaltbar; Stift + langer Druck; Breite ⅓/½/⅔/voll; ausblenden;
  Einstellungen; Katalog aus dem Bestand; Standard = heutiger Aufbau (wird NIE gespeichert, `istStandard`).
- Modell `lib/flaeche/modell.ts` (`anwenden(standard, gespeichert)`, `wende(layout, op, standard)`), Store je Person
  `speicherFuer('flaeche', person)`, Route `/api/state/flaeche?seite=` (GET/PUT). Tests `tests/flaeche.test.ts`.
- Bauteil `components/os/flaeche/Flaeche.tsx`: `<Flaeche seite="x" widgets={[…]}>` für Katalog-Widgets und
  `<Kachel id titel breite><Karte>…</Karte></Kachel>` für feste Karten einer Seite — beides in EINEM Raster
  (6 Spalten, 8-px-Zeilen, ResizeObserver-Spans, dense). Neue Seite anschließen = Karten in `Kachel` wickeln, `seite`-Id
  vergeben. Widgets in `components/os/flaeche/widgets.tsx` (selbstladend, `null` wenn es nichts gibt; Einstellungen
  per `EinstellungDef`; Katalog-Einträge dürfen Voreinstellungen tragen).
- Flächen bisher: Heute (`HEUTE_STANDARD`), `gesundheit-heute`, `gesundheit-koerper`, `ernaehrung`, `zahlen`, `konto`,
  `wachstum`, `familie-wir`, `familie-orga`, `familie-rahmen`, `fokus`, `journal`, `okr`, `system`, `business`,
  `markttraktion-ueberblick`, `finanzchef`, `loops`, `kalender`; seit 27.09. (nur lokal) `markttraktion-sales`, `markttraktion-marketing`,
  `markttraktion-event` — Standardanordnung als Daten in `lib/crm/flaechen.ts` (`KACHELN`, an `<Flaeche standard={…}>` gegeben, getestet);
  Katalog-Widgets `kanal` (Kanal-Leistung) und `event` (Nächstes Event · Make.One). `istStandard` vergleicht Titel gegen den Standard-Titel.
  Weitere Karten-Seiten nach demselben Muster anschließen
  (offen: Wochen-/Tagesplaner, Aufgaben-Board, Inbox, Kompass, Säulen, Stapel, CRM-Unterseiten, Finanz-Details).

## Hochladen nur auf Kevins Wort (26.09. abends)
- Gebaut und überarbeitet wird lokal auf `entwicklung`; Kevin klickt den Stand im Dev-Server (`localhost:3001`) durch
  („Klickdummy“). Nach `main`/Hetzner geht NICHTS ohne Kevins ausdrückliche Freigabe für genau diesen Stand — auch keine
  Tempo-Fixes, keine Deploy-Skripte. Frühere Freigaben gelten nicht pauschal.

## Spaces Privat/Business (26.09., online seit 22:47)
- Grundregel (Kevin): jeder Eintrag trägt seinen Space, der Space filtert, Home/Heute/ZOE sehen beides. Regeln in
  `lib/make-one/space-regeln.ts` (`spaceVonAufgabe`: Ort gibt vor, `task.space` weicht ab; `fokusSchluessel`/`fokusFuerSpace`:
  Fokus gemeinsam oder `privat:jahr`/`business:jahr`). Menü/Kopf: `lib/make-one/spaces.ts` (SPACES · EIGEN · UNTEN,
  `passtZu` Pfad+Parameter), `hooks/useSpace.ts` (Adresse `?space=` gewinnt, sonst Merker). Tests `tests/spaces.test.ts`.
- Seiten: `/os` = Home (`HomeView`, gestaltbare Fläche, Standard = Privat+Business zusammen) · `/os/heute` = feste Tagesseite
  (`HeuteView`) · `/os/wachstum` = Gesamtansicht + Score · `/os/uebersicht?space=` = Dashboard je Space (`SpaceUebersichtView`) ·
  `/os/menschen` = Kontakte privat. Leiste `components/os/Leiste.tsx` (einklappbar, Merker `make-leiste`), Kopf `components/os/Kopf.tsx`.
- Je Space 6 Punkte: Übersicht · Finanzen · Aufgaben · Ziele & Planung + (Privat: Gesundheit · Familie · Kontakte | Business:
  Markttraktion · Mandate). Agenten eigener Kasten. Inbox/Kalender im Kopf folgen dem Space (`?space=`). Postfächer → Space in
  `spaces.json` (`lib/make-one/space-einstellungen.ts`), Kalender → Space in den Kalender-Einstellungen (`lib/kalender/space.ts`, client-sicher).
- Neue Bereiche: Space aus der Adresse lesen (`useSpace().ausAdresse`), nie stumm mischen; Adressen in `lib/wege.ts` eintragen;
  neue Seite in `lib/make-one/spaces.ts` (passt) und `components/os/Schnellsuche.tsx` (SEITEN) anschließen. Keine Weiterleitung
  in `next.config.mjs` darf eine echte Seite verdecken (`/os/uebersicht` war so ein Fall).

## Aufgaben wie Monday/ClickUp (28.09. abends, nur lokal — Plan: AUFGABEN_PLAN.md)
- **Ebenen:** Bereich (Privat | Business) → Space → Projekt → Liste → Aufgabe → Unteraufgabe. Spaces fest `privat` · `kdc` · `kdv` · `ug`
  (= `FINANZ_ORTE` aus `lib/einheiten.ts`, keine eigene Liste) + Mandanten `m-<firmaId>` (CRM-Firma mit aktivem Mandat; beendet/pausiert
  oder Firma weg → „Archiv“, Aufgaben bleiben lesbar). Ohne Projekt → virtuelles Projekt `sonstige-<space>`, ohne Liste → „Sonstige“ (nie gespeichert).
- **Modell** (`types/tasks.ts`, verträglich): `Task.spaceId`, `listeId`, `parentId` (eine Ebene; erbt Space/Projekt/Liste), `statusId`, `bezug`
  {kontaktId, firmaId, mandatId, dealId}, `kommentare[]` {id, von, text, am, erwaehnt}, `startDate`; `Project.spaceId`; Bestand `listen[]`,
  `statusEigen[]` {id, spaceId, label, farbe, basis, sortOrder}. `space`/`einheit` werden aus `spaceId` abgeleitet (Mandant = „Kunden“; eine eigene
  Einheit bleibt im Business stehen); `spaceVonAufgabe` liest zuerst `spaceId` — alle alten Leser verstehen Privat/Business weiter.
- **Status:** Offen (todo/backlog) · In Arbeit · Wartend (blocked) · Erledigt + eigene je Space. Eigenen Status setzen = `statusTeil` (status = basis);
  schreibt jemand `status` direkt (Heads, Abhaken) und er passt nicht zur basis, fällt `statusId` weg — nie umgekehrt.
- **Rein** in `lib/aufgaben/struktur.ts` (Spaces, `uebernehmen`, `baum`, Status, Filter, `erwaehnungen`), `lib/aufgaben/saeubern.ts` (Säuberung,
  Grenzen → `ZuGross` = 413, `kommentareVereinen`: fremde Kommentare unveränderlich, neue tragen Person + Serverzeit), `lib/aufgaben/crm-verweise.ts`
  (Schnellsuche mit `suchPasst`, Links in die Akte, `aufgabenFuer`). Server: `lib/aufgaben/speicher.ts` (`aufgabenAendern` in EINER Sperre).
- **Übernahme des Altbestands** (`uebernehmen`, idempotent, beim Lesen und in jeder Schreibsperre): Projekte/Aufgaben bekommen ihren Space
  (Kategorie/Ort/Einheit), alte `subTasks[]` werden Unteraufgaben (`<taskId>--<subId>`), nie Verlust. Andere Server-Schreiber (Heads, Übergabe,
  Steuern …) dürfen weiter ohne `spaceId` anhängen.
- **Routen:** `/api/state/tasks` — GET Haushalt des Inhabers oder Systemlauf (jede Zeile mit `stand`, dazu `spaces`), PATCH/PUT nur eine Person
  dieses Haushalts; PATCH `{ ops, struktur: { projekte, listen, status } }` mit Stand je Zeile (409 + `konflikte` + aktueller Bestand), > 200 → 413,
  Massen-Wache wie bisher, Änderungsprotokoll ohne Werte. `/api/tasks/create` (ZOE, Meeting, Tageslauf): Haushalt oder Systemlauf, `spaceId`/
  Liste/Eltern/Bezug, ohne Projekt → Sonstige. `/api/aufgaben/crm`: schlanke Verweise (Kennung + Name) für die Verknüpfung.
- **Meldungen** (`melde()`, lib/meldungen): Zuweisung an jemand anderen, Erwähnung (@), Kommentar an Zuständige — nie an die schreibende Person.
- **Browser:** `TasksContext` schickt nur Unterschiede je Liste mit Stand aus der letzten Serverantwort (nie `stand` im Zustand), 409 →
  Server-Stand + Ereignis `make-aufgaben-konflikt`. Seite `/os/aufgaben` = `components/os/aufgaben/AufgabenRaum.tsx` (Adresse `space`, `r`, `p`,
  `ansicht=board`, `offen` = `WEG.aufgabe`, Seite = `WEG.aufgaben`), Schnell-Anlegen ganz oben (`SchnellAnlegen`, Kürzel aus `schnell-anlegen.ts`),
  Detail (`AufgabeDetail`), Board nach Status (`StatusBoard`), eigene Status (`StatusVerwalten`). `/os/aufgaben/board` = alter Zeitstrahl/Delegation.
- **CRM:** Kachel „Aufgaben“ in Kontakt öffnen (`KontaktRechts`) und Firmenakte (`AufgabenAkte`, bei aktivem Mandat im Mandanten-Space).
  Art. 17 löst `bezug.kontaktId` und tilgt Namen auch in Kommentaren, Dubletten biegen `bezug.kontaktId` um, Verbindungsprüfung
  `aufgabe-bezug-tot` (Reparatur entfernt nur tote Einzelverweise), Übergabe setzt `bezug`. Fokus-Block auf eine Aufgabe mit Mandat übernimmt es.
- **Flächen:** Aufgaben-Widget ohne Einstellung nimmt den Space der Fläche (`lib/flaeche/space.ts`); Unteraufgaben nur unter „fällig & kritisch“.

## Markttraktion — Deal- und Follow-up-Ebene (27.09., nur lokal)
- **Marke Make.One (27.09.):** unter den Events läuft unsere Veranstaltungsmarke. `lib/crm/marke.ts` ist die eine Stelle (`MARKE_EVENTS`,
  `markeVon` = gesetzt oder Make.One, `eventName` = „Make.One · Titel“); `Event.marke` optional, Vorgabe beim Anlegen, alte Events gelten
  abgeleitet — nie zurückschreiben. Wo ein Event nach außen genannt wird (ICS, Nachfass-/Follow-up-Text), `markeVon`/`eventName` nehmen, nie den Text streuen.
- **Reiter** (`lib/crm/adresse.ts` `BEREICHE`): ueberblick · kontakte · firmen (a=leads) · deals (a=board|liste|akte|kunden|auswertung) ·
  followup (a=faellig|woche|powerhour|kadenz) · marketing · event · stammdaten. `aufloesen()` übersetzt den alten Sales-Reiter — alte
  Links NIE umschreiben, sondern dort ergänzen. `WEG.deal(id)` öffnet die Deal-Akte.
- **Leiste mit Schnellknöpfen + Bereich Angebot (28.09. abends):** Reihenfolge nur in `LEISTE` (lib/crm/adresse.ts: links · mitte · rechts, jeder Bereich genau einmal — Test `markttraktion-angebot.test.ts`). Mitte = Qualifizierung (orange, `LEUCHT.business`) + Angebot (grün, `LEUCHT.gut`), Puls von hinten per `.mt-schnell::before` in globals.css (aus bei reduced-motion); passt die Zeile nicht (Container `.mt-leistenrahmen` < 1.100 px), stehen die Schnellknöpfe als eigene Zeile über den wischbaren Reitern. Angebot: `?s=angebot&k=<angebot>&kontakt=&firma=&deal=` — Links nur über `angebotLink`/`WEG.angebot`, lesen über `angebotAusAdresse` (ungültige Kennungen fallen weg); gerendert wird `AngebotStart` (components/os/crm/angebot). Der Kopf-Knopf heißt „+ Aktivität hinzufügen“ (vorher „+ Gespräch festhalten“).
- **Firma per Kennung:** `Chance.firmaId`, `Mandat.firmaId` (`lib/crm/firmen-bezug.ts`: `firmaVonDeal`, `dealZuFirma`, `firmenName`,
  `firmaIdsErgaenzen` beim Laden in `ladeCrm`). Neue Stellen vergleichen nie mehr `c.firma === f.name`.
- **Mandanten überall über `MandantLink` (28.09.):** wo außerhalb des CRM ein Mandant/eine CRM-Firma/ein Mandat als Text steht, rendert `components/os/crm/MandantLink.tsx` (`{ mandatId?, firmaId?, name?, klein?, privat?, mandatDa?, firmaDa?, nachName? }`) den Link — Ziel NUR über `mandantZiel` (lib/crm/adresse.ts: Mandat vor Firma, gelöscht → Text „(gelöscht)“, `privat` → nichts, ohne CRM-Zugang → Text). Existenz/Namen aus der Mandat-Kurzform (`components/os/zeit/useMandate.ts`, ein Abruf je Minute); Text-Kunde ohne Kennung nur per eindeutigem Namen (`mandantAusName`), Liquiplan-Posten über `mandatAusPlanposten` (lib/crm/mandant-link.ts). Genutzt: Zeit je Mandat, Mandat-Chip („›“, beim Anlegen `ohneLink`), Ziele/Meilensteine, Finanzplanung-Rechnungen, Liquidität-Posten, Mandatsakte → Firmenakte; Kalender-Mandatsfristen und Schnellsuche verlinken `WEG.mandat`/`WEG.firma`. Tests `tests/mandant-link.test.ts`.
- **Deals anlegen nur über `lib/crm/deal-anlegen.ts`** (`dealAnlegen`, Route `POST /api/crm/deal`, Dialog `components/os/crm/DealAnlegen.tsx`):
  nächster Schritt Pflicht, 409 bei zweitem offenen Deal (mit `trotzdem`), Lead wird SQL. Kein `api.setze('chancen', …)` für neue Deals mehr.
- **Stufenwechsel** prüft der Server (`lib/crm/speicher.ts` `dealRegeln` in `wendeCrmAn`; `wechsleStufe` aus pipeline.ts): der Browser schickt nur
  `stufe` (+ `grund`/`wiedervorlage`/`naechsterSchritt`), nie `historie`. Abgelehntes kommt als `fehler[]` in der Antwort von `PATCH /api/crm/bestand`.
- **CRM-Bestand mit Stand (28.09., K4):** `GET /api/crm/bestand` liefert jeden Eintrag aller `CRM_LISTEN` mit `stand` (Fingerabdruck, `lib/crm/crm-stand.ts` `crmMitStand` — vor dem IBAN-Maskieren gerechnet). `PATCH` prüft `op.stand` (nur am Op, nie im Eintrag) in der Sperre: veraltet → 409 `konflikte[]` mit aktuellem Eintrag, ganze Änderung abgelehnt. Ohne Stand nur `teil`/`delete`; `upsert` über einen bestehenden Eintrag ohne Stand → 409 (Ausnahme Firmen: Upsert füllt nur Lücken). Browser: `api.setze/teil/weg` (daten.ts) schicken den Stand aus der letzten Server-Antwort (`crmStaende`), nacheinander in einer Kette; bei 409 Hinweis + `laden(true)`. Neue Server-Schreiber: `aendereCrm` direkt (kein Stand nötig) oder `teil` ohne Stand — nie ganze Einträge aus einem alten Stand.
- **Löschsperre (28.09., K4):** Firma mit Personen/Deals/Mandaten/Rechnungen, Mandat mit Rechnungen → 409 `sperren[]` mit Anzahlen (`loeschSperren`; Rechnungen über `mandatId`, alte über `rechnungPasst`). Deal-Historie nie kürzen, Grenze `HISTORIE_MAX` (5.000) → 413.
- **Deal-Verschiebungen (28.09., K4):** `erwartetUrsprung`/`erwartetVerschoben` setzt nur `dealRegeln` (`erwartetVerschiebung` in pipeline.ts: nur nach hinten zählt); ab `VERSCHOBEN_GELB` (2) Ampel gelb. `prognose().gewichtetOhneHaengende` (ohne rote Deals) geht an den Head of Finance. Gemessene Quote je Stufe: `gemesseneQuoten` (deal-auswertung.ts, ab `MINDESTMENGE`), in Stammdaten mit „übernehmen“.
- **Follow-up-Ebene:** Typ `FollowUp` (typen.ts), Bestand `crm.followups`; reine Logik `lib/crm/followup.ts` (`faellige` = echte + virtuelle aus
  Kontakt.naechsterSchritt/wiedervorlage, Chance.naechsterSchritt, Teilnahme.followUpAm, Mandat.naechstesReview, Kadenz je Kreis; Kennungen `v:<quelle>:<id>`),
  Route `/api/crm/followup` (anlegen/erledigen/verschieben/absagen; Erledigen schreibt eine Aktivität mit denselben Regeln wie /api/crm/aktivitaet),
  Ansicht `components/os/crm/FollowUp.tsx`. Neue Nachfass-Logik kommt hierher, nicht in ein neuntes Feld.
- **Auswertung:** `lib/crm/deal-auswertung.ts` (Verweildauer, Umwandlung, Win/Loss, Zyklus, Prognose nach Monat, hängt nach Wert; `MINDESTMENGE` 5).
- Wertelisten (`CrmBestand.wertelisten`: Verlustgründe, Kadenz je Kreis, Ergebnisse, Ziele) pflegt Stammdaten; Verbraucher lesen sie mit Rückfall auf die Konstanten.
- **Auswahl in Formularen = `Wahl`-Chip** (`components/os/crm/Wahl.tsx`: `Wahl`/`WahlMehrfach`, Menü am Chip, Vorschlag aus `lib/crm/vorschlaege.ts`, reine Hilfen `lib/crm/wahl.ts`); Pillenreihen nur für Filter, Reiter, Navigation und echte Zweier-Umschalter. Vorschläge nie still speichern. Gesellschaften über `GESELLSCHAFT_WAHL` (Namen aus `lib/einheiten.ts`).
- **`Wahl` kann neu anlegen (27.09. spät):** `onNeu(text) → Promise<Wert | null>` (+ `neuMin`/`neuMax`, `leerenLabel`, `fuss`) — Menü immer mit Suchfeld, unten „+ neu …“ bzw. „„<Suchtext>“ anlegen“, Enter legt an und wählt, Fehler im Menü (reine Hilfen `anlegenZeile`/`neuPruefen` in `lib/crm/wahl.ts`). Typ/Kategorie der Akte = `WertelistenEinzelWahl`, Branchen = `WertelistenWahl` (mehrfach), beide über `useWertelisteAnlegen`. `EinheitWahl` (Aufgaben/Routinen) baut auf `Wahl` — kein zweites Auswahl-Bauteil bauen. Deal-Akte: „Vorschläge übernehmen (n)“ über `offeneRollenVorschlaege`/`vorschlaegeAnwenden`/`vorschlaegeZuruecknehmen` (ein `teil`-Patch mit ganzem `personenRollen`).
- **Masterlisten-Import „Online gewinnt“ (27.09.):** `lib/make-one/crm.ts` — `Kontakt.vonHand` (Stammdaten-Felder, die von Hand gesetzt wurden;
  `vonHandMarkieren` läuft in `PATCH /api/state/kontakte` über die Haken `vereinen`/`neu` von `listePatchen`), `zusammenfuehren` füllt Lücken, liefert
  `konflikte` statt zu überschreiben (`istVonHand`; Bestand ohne Liste: nach dem Import geändert ⇒ Konflikt), `schluessel` tolerant (`normName`/`normFirma`),
  `besitzerAusOwner`, `moeglicheDubletten`. Route `POST /api/crm/import` mit `vorschau:true` (schreibt nichts), ohne → schreibt und legt Konflikte in
  `crm-import-konflikte` ab (`lib/crm/import-konflikte.ts`), `aktion:'konflikt'` entscheidet einzeln, GET liefert den Stand. Segment `seg-vernetzen` entsteht
  beim ersten Import. Neue Schreibwege für Stammdaten-Felder müssen `vonHandMarkieren` rufen — sonst überschreibt der nächste Import die Handarbeit.

## Kalender-Oberfläche (components/os/kalender, seit 27.09.)
- `/os/kalender` = `Kalender.tsx` (Tag/Woche/Monat/Agenda). Daten nur über `useKalender` (`/api/kalender`), Schreiben nur über `/api/kalender/termin` (iCloud) — nie mehr über `/api/apple-calendar/create`.
- Zeiten sind Berliner Wandzeit `YYYY-MM-DDTHH:mm:ss` (`lib/kalender/zeit.ts wandAus`), Raster 15 Minuten. Überlappung über `lib/kalender/layout.ts spaltenLegen`.
- Schnelleingabe `lib/kalender/schnell.ts` (rein, getestet) — neue Muster dort ergänzen, nie im Dialog parsen.
- Serien/Erinnerungen entstehen beim Anlegen (`rruleText`, VALARM); Ändern von Serien bleibt in Apple (`aendereTermin` lehnt ab).

## Brain (lib/brain, seit 27.09.)
- Wahrheit ist der Vault (Markdown, Obsidian). Der Index (`lib/brain/index.ts`, SQLite FTS5 + Vektoren) ist abgeleitet — bei Zweifel Datei löschen, der Takt baut neu.
- Suche immer über `suche()` in `lib/zoe/vault.ts` (nimmt den Index, sonst Dateisuche). Sicht (`darfSehen`) gilt VOR dem Ranking — nie nachträglich filtern.
- ZOE schreibt ins Brain nur über `lib/brain/inbox.ts vorschlagAblegen` (plus Zoe_Log). Menschen: Regeln (`lib/brain/regeln.ts`) und Freigaben. Nie Notizen überschreiben.
- Regeln (`00. Fundament/Regeln`) und Konstitution sind ANWEISUNGEN an ZOE — nur `status: aktiv` mit `freigegeben_von` wird geladen (`regelnFuerPrompt`). Alles andere aus dem Vault bleibt Daten (`fremd()`).
- Lokal NIE in Kevins echten Vault schreiben; Tests setzen `MAKE_VAULT_DIR` auf einen Temp-Ordner und `MAKE_OS_DOKU_WURZEL=aus`. Embeddings sind im Test aus.

## Datenschicht (lib/store/local-db.ts, Stufe 1 seit 27.09.)
- `loadJson` gibt nur bei „Datei fehlt“ null; Lesefehler werfen `BestandNichtLesbar`, ein beschädigter Bestand blockiert Schreibungen (`BestandBeschaedigt`). Nie `catch → null` um loadJson legen, wenn danach geschrieben wird.
- `updateJson`/`saveJson` schreiben nicht, wenn der Stand unverändert ist — Zeitstempel als „Beweis für einen Lauf“ gehören in den Inhalt, nicht in die Dateizeit.
- Neue Bestände, die ständig geschrieben werden, aber in keinen Index eingehen, in `RAUSCHEN` (lib/store/memo.ts) eintragen — sonst leeren sie den Zwischenspeicher.
- **Nie abschneiden, ablehnen (28.09.):** Säuberungen kürzen keine Listen (kein `.slice(0, n)` über Bestand, auch nicht beim Lesen) — wer über eine Grenze wachsen will, bekommt 4xx mit Text (413). Grenzen des Finanzplans: `GRENZEN` in `lib/finanzen/finanzplan-bestand.ts`, auch für ZOE und Beleg-Übernahme.
- **Geteilte Listen nur per Einzeländerung mit Stand (28.09.):** Ziele, Meilensteine, Routinen, Blöcke, Aufgaben — nie die ganze Liste zurückschreiben. Browser: `ListenSchreiber` (`lib/make-one/liste-stand.ts`: Absicht je Kennung, Stand aus dem letzten Serverstand, Senden nacheinander, Sicht = Server + Offenes); Server: `listePatchen` (GET liefert `mitStand`, 409 mit aktuellem Bestand). Folgeschritte wie die Ziel-Kaskade über `danach` in derselben Sperre. Zwei Bestände in einer Sperre: `updateJsonAsync` (außen), innen `updateJson` eines ANDEREN Bestands.
- **Meldungen / Glocke (28.09. abends, B2):** melden nur über `melde()` (`lib/meldungen/melden.ts`, wirft nie, nie an `von` selbst, nur an Personen im Haushalt des Inhabers). Speicher `meldungen--<person>` (`lib/meldungen/speicher.ts`), Regeln rein in `lib/meldungen/regeln.ts`: je Art + Bezug eine ungelesene (neuere ersetzt), Grenze 500 — erst älteste gelesene weg, dann älteste ungelesene zu „+N weitere“ zusammenfassen, nie still löschen. Fällig/überfällig nie speichern, beim Lesen aus `tasks` ableiten (Berliner Tag, Merker je Tag). Route `/api/meldungen` (GET ETag, POST `gelesen`/`einstellungen`, nur eigene, Dienstweg ohne Person 403). Glocke `components/os/Glocke.tsx` im Kopf: Abfrage beim Laden, bei Fokus und alle 60 s nur sichtbar. Telegram: Einstellung `telegram` (aus), versendet wird erst in `telegramHaken` — heute nichts.
- **Rechnungen ab „gestellt“ (28.09., K3):** nie löschen, Betrag/Nummer/Datum/Netto/USt-Satz nie ändern (Nachtragen leer → Wert erlaubt), kein Zurück im Status — stattdessen `PATCH /api/state/finanzplan { aktion: 'storno', rechnungId, grund, stand? }` (Status `storniert` + `storniertAm`/`stornoGrund`; Gegenbuchung `bu-st-<id>` zum Eingang `bu-re-<id>`, in derselben Sperre). Regel an EINER Stelle: `rechnungSchutz` in `lib/finanzen/finanzplan-bestand.ts` (Route PATCH/PUT und ZOE). Wer Rechnungen zählt: `storniert` ist weder offen noch Umsatz — nie „alles außer bezahlt“ als offen nehmen. Dateiablage: Einträge mit `rechnungId`/`mandatId` (`istBeleg`) nicht löschbar (409), nur vom Bezug lösen.
- **Finanzplan-Listen mit Stand (28.09., K3):** GET liefert je Eintrag `fassung` (nicht `stand` — `Firma.stand` ist das Kontostand-Datum); ops tragen `stand` oder `eintrag.fassung`, veraltet → 409 mit `konflikte[]` + ganzem Stand. Seiten mit `useSpeichern` übergeben `standFeld: 'fassung'` (Stand kommt aus dem letzten Serverstand, Speichern läuft nacheinander).
- **Geld auf den Cent (28.09., K3):** Beträge `Math.round(x*100)/100`, nie auf ganze Euro; `Rechnung.betrag` ist brutto in €. Brutto/Netto/USt nur über `lib/finanzen/ust.ts` (kaufmännisch je Rechnung) — keine eigenen `/ 1.19` oder `* (1 + satz/100)`. Der Rechenkern v3 bleibt, wie er ist (echte Cent-Ganzzahlen dort entscheidet Kevin).
- **„Heute“ = `localDay()`, Tag eines Zeitstempels = `tagVon(iso)` (28.09., K3):** nie `new Date().toISOString().slice(0, 10)` oder `jetzt.slice(0, 10)` — das ist der UTC-Tag (nachts bis 2 Uhr gestern). `leads()` verlangt `heute`. Wächter in `tests/repo-sauber.test.ts` (Ausnahmen mit Grund). Monatsfristen „+1 Monat“ kappen am Monatsende.
- Kontakte im Browser: `api.kontaktTeil(id, felder)` statt ganzer Kontakt; jede Zeile trägt `stand` (Fingerabdruck), der Server antwortet 409 bei Konflikt — nie `stand` selbst setzen oder speichern. `listePatchen` prüft in der Sperre (`pruefen`), Konflikte kommen als `konflikte[]`.
- **Felder leeren = `null` (28.09., F1):** JSON verwirft `undefined`. Kontakte: `kontaktTeil` übersetzt `undefined` → `null` (`leerAlsNull`), der Server entfernt das Feld (`teilAnwenden`, nie `id`/`stufe`/`aktivitaeten`/`zahlung` …). CRM-Bestand: `api.teil(liste, id, nurFelder(teil))` (`undefined` → `''`, die Säuberer lassen es weg). Nie `{ ...eintrag, ...teil }` als ganzen Eintrag aus dem Browser-Stand schreiben.
- **Firmen-Upsert führt zusammen (28.09., F1):** `firmenId` kommt aus dem Namen ohne Rechtsform — vor dem Anlegen `bestehendeFirma(firmen, name)` fragen und verknüpfen. Serverseitig (`wendeCrmAn` → `firmaZusammenfuehren`) füllt ein Upsert mit bestehender Kennung nur leere Felder; ändern nur über `teil`.

## Agenten — Querliegendes
- Jeder Modellaufruf geht durch `lib/anthropic.ts askText`: dort sitzt der Guthaben-Schalter (`guthabenLeer()`, 30 min Pause nach „credit balance too low“). Nie eigene Aufrufe an die API daneben bauen.
- `runAgent` (lib/zoe/agenten.ts): `post`/`get` werfen bei Fehlerstatus, `ok:false` oder `error` — ein Lauf ist nur `ok`, wenn die Route es ist. Neue Fälle: Ergebnis prüfen, nicht Text.
- Ohne KI liefern Läufe Regelwerk (`lib/zoe/regelwerk.ts` für Morgen/Abend, `ohneKi` bei Heads/Finance) — kein Fehlschlag, der den Takt in die Pause zwingt.
- Der Agenten-Schalter unter /os/agenten gilt für ZOE, Takt UND direkten Aufruf (`resolveAgent` + `disabledResponse`, 409).

## Head of IT (HOI)
- Der HOI ist kein KI-Agent, sondern ein Lagebild aus Zahlen: `lib/hoi/lage.ts` (rein: Befunde + Ampeln), `lib/hoi/innen.ts` (einsammeln), `lib/hoi/rechnen.ts` (Zähler), Seite `/os/hoi`, Routen `/api/hoi/{lage,aussen,csp}`.
- Drei Quellen: innen (App), Host (`deploy/lage-sammeln.sh` → `<daten>/system/lage.json`, Klartext, nur Zähler), außen (`.github/workflows/hoi-aussenblick.yml`).
- `MAKE_OS_KEY_HOI` ist ein eingeschränkter Schlüssel: die Middleware öffnet damit NUR `/api/hoi/*` (Kopf `x-make-hoi: 1`). Nie den Dienstschlüssel an GitHub geben.
- `/api/hoi/csp` (POST) ist bewusst offen (Browser-Berichte kommen ohne Sitzung): nur Zähler speichern, Rate begrenzen, nie Inhalte. Neue Befunde: Schwelle + Satz in `lage.ts`, Test in `tests/hoi-lage.test.ts`.
- Grundsatz: keine Personen, keine Adressen, keine Inhalte im Lagebild — Zähler und Zustände.

## Zeit & Fokus (26.09. spät, nur lokal)
- **Modell:** `lib/zeitmessung/modell.ts` (rein, getestet): Zeit je Person, Tag und Schlüssel
  `space:bereich`, zwei Arten — `auto` (Anwesenheits-Ping alle 30 s, Differenz ≤ 90 s zählt)
  und `bewusst` (Fokus-Zähler). `bild(datei, heute)` liefert heute/7 Tage je Space und Bereich,
  Fokus-Tage (≥ 25 min bewusst), Blöcke. Bereich aus der Adresse: `lib/zeitmessung/bereich.ts`
  (Menüpunkte der Spaces + feste Namen home/heute/wachstum/system/zoe/inbox/kalender).
- **Speicher:** `lib/zeitmessung/speicher.ts`, Bestand `zeit`/`zeit--<person>`; Pings werden
  120 s gepuffert (keine Schreibung alle 30 s). Route `/api/state/zeit` (GET Bild, POST Fokus-Block).
  Der Ping in `components/os/Mitarbeit.tsx` schickt `pfad`, `suche`, `space`; verbucht wird in
  `app/api/state/anwesenheit/route.ts`.
- **Kopf (`components/os/Kopf.tsx`):** ganz links `WachstumsZahl` (Score, Klick → Wachstum),
  Suchfeld mittig, `FokusZaehler` (localStorage `make-fokus`), rechts `SpaceSchalter` (Klick =
  Modus-Wechsel, Pfeil = Index-Seite, Zeit heute). Ereignis `make-zeit-geaendert` frischt auf.
- **Säule `fz` „Fokus & Zeit“** in beiden Indizes: `lib/zeitmessung/kennzahlen.ts` (`FZ_SAEULE`,
  `fzKennzahlen(space)`, `fzMessen`). Gewicht 10 %, andere Säulen ×0,9 (Verhältnis bleibt; Tests
  prüfen das). Unter 1 h in 7 Tagen: Lücke, keine Note (`MIN_MESSUNG_SEK`). Die Zeit ist
  persönlich: `privatStand(haushalt, heute, zeit, person)` trägt die Person im Memo-Schlüssel,
  `bestandFuer(roh, scope, zeit)` im Business; Routen `/api/privat`, `/api/business` und
  `lib/performance.ts` laden `zeitBildFuer(person)`.
- Widget `zeit` in `components/os/flaeche/widgets.tsx` (Einstellung `space`; seit 27.09. spät `nach: einheit` + `zeitraum`/`wer`).
- **Zeit je Einheit (27.09. spät):** `FokusBlock` trägt optional `aufgabeId`/`einheit` (nur Business). Säuberung NUR über
  `zuordnungSaeubern` (`lib/zeitmessung/einheiten.ts`: Einheit der Aufgabe gewinnt, `sauberEinheit`, Privat/Gemeinsam verwirft);
  Auswertung dort rein (`zeitJeEinheit`, Tage nach Berliner Wandzeit, Einheit live aus der Aufgabe, Block-Wert = Rückfall).
  Wege: POST `/api/state/zeit` `fokus` (+ Zuordnung) / `zuordnen`; GET `/api/state/zeit/einheiten?zeitraum=woche|monat&stichtag=`
  (Haushalt je Person + gesamt, `merken` mit `zeitBloeckeStand()` im Schlüssel — `zeit` ist Memo-Rauschen). Laufender Fokus im
  Browser nur über `lib/zeitmessung/fokus-laufend.ts` (`fokusMerken`, `fokusFuerAufgabe`, Ereignis `make-fokus-geaendert`).
  Oberfläche `components/os/zeit/` (`ZuordnungWahl`, `ZeitJeEinheitKarte`, `FokusBloeckeKarte`); Tests `tests/zeit-einheiten.test.ts`.
- **Umbuchen Privat ↔ Business (27.09. spät):** POST `/api/state/zeit` `{ aktion: 'umbuchen', von, space }` — nur eigene Blöcke
  (`personStreng`, alle POST ohne Person 401; fremder Block 404, es wird nichts angelegt). `blockUmbuchen` (modell.ts) verschiebt die
  bewussten Sekunden im selben Tag auf den neuen Schlüssel; nach Privat fallen `aufgabeId`/`einheit` weg. Zeit je Einheit zählt nur
  Business-Blöcke — Privat-Zeit der anderen Person erscheint dort nie (Test `tests/zeit-route.test.ts`).
- **Mandat an Zielen und Zeit (28.09.):** Ziel, Meilenstein und `FokusBlock` tragen optional `mandatId`/`firmaId` (nur Business).
  Rein in `lib/planung/mandat.ts`: `bezugSaeubern` (nur Form, CRM-Kennung), `mandatKurzListe` (Einheit über `einheitAusBezug`,
  Monatshonorar netto), `mitMandatBezug` (Firma + Einheit aus dem Mandat; Mandat gewinnt vor Aufgabe/Wahl). Schreibwege Ziele,
  Meilensteine, `/api/state/zeit` leiten ab (`mandateFuerBezug` liest das CRM nur, wenn eine `mandatId` kommt). Chip
  `components/os/zeit/MandatWahl.tsx` (GET `/api/crm/mandat-wahl`, Haushalt des Inhabers); Zeit je Mandat `lib/zeitmessung/mandate.ts`
  + GET `/api/state/zeit/mandate` (Karte auf Fokus, „Zeit“ in der Mandatsakte, „≈ €/h“ nur grober Hinweis). Tote Bezüge: Verbindungsprüfung
  `ziel-/meilenstein-/zeit-mandat-tot` (`lib/crm/verbindungen-planung.ts`, reparierbar = Bezug entfernen) — bewusst keine Löschsperre.
  Tests `tests/mandat-bezug.test.ts`.

## Tempo (26.09.)
- Teure Berechnungen (Indizes, Familie, Bauplan) laufen durch `merken(schluessel, ttl, rechne)` aus `lib/store/memo.ts`;
  jede Schreibung über local-db setzt den Speicher zurück. Schlüssel MÜSSEN Person/Haushalt tragen. Neue teure Routen
  genauso kapseln, nie Rohdaten je Seitenwechsel neu lesen. Client: Widgets holen über `useDaten` (20 s), Kopf-Index 5 min.
- Nie auf dem Server bauen: Auslieferung = Bild von GitHub (siehe DEPLOY.md). Server ist 1 vCPU/2 GB.

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
  (`wartenNachFehler`, lib/zoe/takt.ts) — nie wieder Minuten-Schleifen.
  Nur ein Arbeiter je MAKE OS (`.data/worker.pid`).
- Stores: JSON-Dateien unter `.data/` via `lib/store/local-db.ts`
  (loadJson/updateJson). API-Gate: `x-make-key`-Header (MAKE_OS_KEY).
- `route.ts` darf keine Extra-Exporte tragen (Next) — geteilte Typen in `lib/`.
- Alt-Adressen nur in `next.config.mjs` `redirects()` — keine Weiterleitungs-Seiten
  unter `app/` (die Config gewinnt, die Seite wird toter Code; am 26.09. zeigte
  `/os/woche` so aufs falsche Ziel). Umgekehrt darf eine echte Seite keine
  Config-Weiterleitung mehr haben (Falle `/os/uebersicht`). Prüfrezept für die
  ganze Software: Prod-Bau `make-os-pruefbau` (3011) + Testkonto + Seiten-Crawl
  (siehe UPDATES.md „Durchsicht 26.09.“).
- Seiteneffekte nie im setState-Updater (StrictMode führt doppelt aus).
- KI-Aufrufe über `lib/anthropic.ts` (askText/askJson) — nie direkt.
- `main` bleibt immer lauffähig: Feature-Branches, kleine Commits, Merge nach
  kurzem Review.

## Doku
- `DATENARCHITEKTUR.md` — Befund und Stufenplan zur Datenschicht (26.09. spät; **dringend für den 27.09.**, Speicherfrage JSON/SQLite entscheidet Kevin).
- **Tiefe Akzente (seit 25.09.2026, Kevin: „nicht diese Neonfarben, aber nicht platt — die
  Akzente sind wichtig“):** Vorbild ist das Kürzel in der Kontakt-Akte. Große Farbträger
  (Ringe, Balken, Kürzel, Hauptknöpfe) nehmen das Rezept `TIEF` aus design.ts: kräftige
  Farbe mit Tiefe (Verlauf in den tieferen Ton `TIEF.tiefer`/`TIEF.verlauf`), getönte
  Fläche (`TIEF.flaeche`), halbtransparente Kontur (`TIEF.rand`), weicher Schein
  (`TIEF.schein`/`svgSchein`) — nie Vollfarbe mit Leuchtkranz. Zahlen in Ringen bleiben
  WEISS. Hauptknopf = `TIEF.knopf(farbe)`. Leuchtkränze höchstens mit Alpha 33/40.
- **`Knopf` sperrt sich selbst (28.09., K4):** liefert `onClick` ein Promise, ist der Knopf bis zu dessen Ende gesperrt (`aria-busy`, `lib/make-one/klick-sperre.ts`). Speichern/Anlegen als `async` übergeben (`onClick={async () => { await … }}`), nicht `() => void …` — sonst greift die Sperre nicht.
- **Schlanke, lebendige Oberfläche (seit 23./24.09.2026):** neue Seiten nur mit
  den Bauteilen aus `components/os/schlank.tsx` (Seite, Karte, Ring, Zahl,
  Balken, Chip, Zeile, Haken, Segmente) und den Leuchtfarben `LEUCHT` aus
  design.ts — Karten mit Tiefe, Glow, hochzählende Zahlen, gestaffeltes
  Erscheinen; eine Ebene, nie eine Null, Farbe bedeutet Zustand. Alle Einträge der
  Leiste (Heute · Wachstum · Gesundheit · Inbox · Aufgaben · Zahlen · Kontakte ·
  ZOE · System) sind umgebaut; Anmeldung führt zu Heute, ZOE ist kein
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
  (`istPrivatPosten`/`nurBusiness` in `liquiditaet.ts`). ZOE: Haushalt NUR
  über `blockHaushalt` in Gespräch/Morgen/Empfang, nie in `gatherBrain`.
  Test-Haushalt „test“ für Fotos, echte Prüfdaten nur in `.data/pruefdaten/`.
  Umzug: `app/api/haushalt/umzug`, Einfrieren: `docs/make-orga/`.
  Fixkosten (27.09.): ein Posten = die Ausgaben-Buchungen eines Empfängers; Bearbeiten/Umstufen fix↔variabel = EIN Patch mit Stand
  je Zeile, nur dieser Posten (Empfänger-Regel nur per Häkchen); `Turnus` hat fünf Werte (`TURNUS_REIHE`, `turnusName`), „Rhythmus
  unklar“ endet mit `turnus_geklaert` auf den Buchungen (`rhythmusVorschlag` rein); Budget je Kategorie zählt nur variable Ausgaben;
  Schreibfehler des Patch-Wegs kommen immer als JSON mit Text (Route + `patchen`), die Oberfläche zeigt sie an der Zeile.
- **Head of Finance (24.09.2026): der Finanzagent auf allem.** `lib/finanzen/chef/`:
  `finanzbild.ts` rechnet ALLES deterministisch (Business, Haushalt nur mit
  Zugang, Brücke, Steuertermine, Hinweise); das Modell ordnet nur ein
  (`prompt.ts`, 5 Modi, JSON-Schema). `pruefer.ts` prüft jede Zahl, Quelle,
  Frist + Vollzug/Anlageprodukte → eine Korrekturrunde. Er bewegt nie Geld:
  Vorschläge → Freigabe-Liste (`stand.ts`, Dedup) → angenommen = Aufgabe
  (privat ohne Beträge, Tag „haushalt“). Takt über `plan.ts`/`takt.ts`, ein Lauf
  je Haushalt gleichzeitig; Haushalts-Ergebnisse in Warteschlange/Agenten-Log
  nur als Zähler. Speicher: `finanzchef` (Business) · `haushalt-chef--<h>`.
- **Navigation (24.09.2026, Kevins Vorgabe):** links nur ZOE · Brain (Wissen) ·
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
  alte Bereiche in `lib/crm/adresse.ts`). Aufbau (seit 27.09., acht Reiter): **Überblick** (Traktions-Index, Heads, Übergaben, Befunde — `/api/crm/traktion`) · **Kontakte** · **Firmen** (Kartei + Leads) · **Deals** (Board · Liste · Kunden · Auswertung) · **Follow-up** (Fällig · Woche · Power Hour · Kadenz — `lib/crm/followup.ts` ist DIE Fälligkeitsliste, auch für Power Hour, „Für dich“ und Befunde) · **Marketing** · **Events** · **Stammdaten**. Eine Person im CRM-Bestand entfernen/umbiegen/aufzählen geht nur über `lib/crm/person-verweise.ts`; Win Rate nur über `winRate`/`WIN_RATE`, Gespräche nur über `echtesGespraech` (beide `lib/crm/pipeline.ts`). **Traction-Score** (`lib/crm/traktion.ts`):
  Gewichte aus dem KEMARIS-Konzept (Sichtbarkeit 15, Marketing 25, Vertrieb 30,
  Events 10, Conversions 20) → Sales 50 · Marketing 40 · Event 10; Punkte aus der
  Ampel, grau zählt nicht, gesamt = gewichtetes geometrisches Mittel, fehlende
  Welten → „vorläufig“; Grundlage (Datenreife, Art. 14, Ansprechbar) zählt NICHT.
  Er ist der Faktor „Markttraktion“ im Business-Score. Im Code heißt die
  Datenschicht weiter `crm` (lib/crm, /api/crm, Speicher `crm`) — das ist die
  Kartei darunter, nicht der Name; sichtbar und für ZOE heißt es Markttraktion. Personen im Speicher
  `kontakte` (Modell `lib/make-one/crm.ts`), alles daran im Speicher `crm`
  (`lib/crm/`: pipeline, recht, heute, kunden, events, dubletten, umzug).
  Grundkonzept aus der Markttraktion (KEMARIS Operations) — **Daten nur eigene**
  (Masterdatei `~/Desktop/CRM Leadordner`, Brain); nie Daten aus Operations/HubSpot
  holen, das Adressbuch der Kontakte-App bleibt draußen. **Kanal-Ampel
  (`lib/crm/recht.ts`) gilt für jede Karte, jeden Entwurf, jedes Agentenpaket**:
  LinkedIn-Nachricht = elektronische Post, Kaltanruf nur mit Anlass, Werbesperre
  sperrt alles — keine Rechtsberatung, einmal anwaltlich gegenlesen. Kunden
  = Mandate (`kundenAusMandaten` für Score/ZOE); Mandat → Liquiplan nur als
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
- **Akte mit Reitern (27.09., Malins Rückmeldung, nur lokal):** kompakter Kopf (Typ/Kategorie als Chips) + Reiter Überblick · Stammdaten · Beziehung · Verlauf · Datenschutz (`t=` in der Adresse, `kontaktAkte(id, t)`, ohne `t` = Überblick), zwei Spalten ab `SPALTEN_AB`, Abschnitte einklappbar (localStorage `mt-akte-zu-<id>`, Reiter `mt-akte-reiter-<id>`); Typ/Kategorie/Branchen über `WertelistenWahl` (alle Werte, Suche ab `SUCHE_AB`, „+ neu“ schreibt über `POST /api/crm/stammdaten` aktion `wertelisten`); Matrix-Gruppen einzeln als `MatrixTeilInhalt`.
- **Kontakt öffnen (28.09., H1, nur lokal — ersetzt „Akte öffnen“ in der Oberfläche):** Wort ist überall „Kontakt öffnen“/„Kontakt“ (Deal-Akte bleibt Deal-Akte); Adresse bleibt `a=akte`. Kopf wie gehabt, darunter drei Spalten ab `SPALTEN_AB` (sonst links · Reiter · rechts untereinander): links `KontaktLinks` (Kontaktdaten, Schnellaktionen Notiz · E-Mail · Anruf · Aufgabe · Meeting — nur über `/api/crm/aktivitaet`, `/api/crm/followup`, `EntwurfTeil` + `mailto:`/`tel:` bei nicht roter Ampel, **nie Versand**; Meeting mit `wann`/`ort` über `meetingWann`, H4), rechts `KontaktRechts` (Firma via `firmaVerknuepfen`, Deals via `DealAnlegen`, aktive Mandate, offene Follow-ups aus `faellige`), beide in `KontaktSpalten.tsx`; Karten über `Klappe`/`useKlappen` (`kontakt-klappe.tsx`, Merker `mt-akte-zu-<id>`). Reiter `AKTE_REITER` = `ueber | aktivitaeten | umsatz | daten` (`akteReiter` übersetzt ueberblick→ueber, verlauf→aktivitaeten, stammdaten/beziehung/datenschutz→daten; `u=` nur bei Aktivitäten über `akteUnter`; `kontaktAkte(id, t, u)`). Über = `KontaktUeber.tsx`: Zusammenfassung rein aus `lib/crm/zusammenfassung.ts` (Sätze mit Quellen ①②, Anker aus `ankerListe` → `t=aktivitaeten&u=alle#akt-…`), „Frage stellen“/„Mit ZOE formulieren“ über `app/api/crm/kontakt-frage` (GET = KI verfügbar?, POST mit `kontaktPaket`: nie `privatNotiz`, Werbesperre → kein Paket, 402 = freundlicher Hinweis).
- **Lifecycle (28.09., Regel H4):** `Kontakt.phase?: LifecyclePhase` (`lib/crm/lifecycle.ts`: lead · mql · sql · opportunity · angebot · kunde · follow_up, `LIFECYCLE_WAHL`, `lifecycleAusListe`) — Pipeline-Feld, von Hand über `LifecycleWahl` (Wahl-Chip, kein Leeren). Vorschlag `lifecycleVorschlag` in dieser Reihenfolge: aktives Mandat → kunde · offener Deal in angebot/abschluss → angebot · sonst offener Deal → opportunity · **erst dann** beendetes Mandat/gewonnener Deal → follow_up · Lead SQL → sql · Antwort/Anfrage/Event „da“/Score warm → mql · sonst lead (offener Deal schlägt früheres Mandat). **Ohne gesetzte Phase gilt „Lead“** (`lifecycleVon` → `{ phase: 'lead', vorschlag }`, es wird nichts gespeichert); der Chip zeigt einen Vorschlag nur, wenn er höher als Lead ist (`lifecycleVorschlagHoeher`). Kartei-Spalte/Filter, Segment-Kriterium `lifecycle`, Export `LIFECYCLE_PHASE` (gilt) / `LIFECYCLE_GESETZT` (nur von Hand, sonst leer), Heads `lifecycle` + `lifecycle_verteilung` rechnen mit „gesetzt, sonst Lead“. Import: `ausZeile` belegt aus LIFECYCLE vor, `zusammenfuehren` nur bei leerer Phase — nie überschreiben. Nicht verwechseln mit der Beziehungs-Lebensphase (`phaseVon`, Reiter Daten).
- **BEAN-Kundengruppe (28.09., H4):** `Kontakt.bean` / `Firma.bean` (`'B'|'E'|'A'|'N'`, Handfeld wie `phase`, in `PIPELINE_FELDER`, Import nie). Ableitung rein in `lib/crm/bean.ts` (`beanVon`, `beanFirma`, `beanFuerLead`, `beanVerteilung`) mit Grund, Vorrang **B > A > E > N**: B aktives Mandat (Person oder Firma) · A Deal in angebot/abschluss, Mandat angebot/verhandlung, offenes Angebot der Ablage · E beendetes/pausiertes Mandat, gewonnener Deal ohne aktives Mandat, Lebensphase/Firmen-Rolle `ex_kunde` · N sonst. Lesen: von Hand an der Person → von Hand an der Firma → abgeleitet. Die Dateiablage (`opts.angebote`, Hook `useOffeneAngebote` in `components/os/crm/bean-teile.tsx`) zählt nur in der Oberfläche — Segmente, Export und Heads rechnen ohne sie (nie an Agenten). Oberfläche: `BeanWahl` (Kopf + links + Firmen-Karte; gestrichelt = automatisch, „zurück auf automatisch“), `BeanBadge` (Kartei-Spalte, Leads), Filter in Kartei (`?bean=`, `karteiBean`), Leads und Runde (Pille „Neu“, `RundenFilter.bean`), `BeanVerteilungKarte` im Überblick, Segment-Kriterium `bean` (auch der Server-Speicher `segment()` behält jetzt `temperatur`/`lifecycle`/`bean`), Export-Spalte `BEAN`, Heads `bean` je Person/Lead + `bean_verteilung`.
- **Kontakt öffnen · Reiter Aktivitäten (28.09., H3, nur lokal):** `components/os/crm/kontakt/AktivitaetenReiter.tsx` (+ `aktivitaeten-teile.tsx`), Logik rein in `lib/crm/aktivitaeten.ts` (`aufbereiten` → `filtern`/`zaehlen`/`gruppieren`). Unter-Reiter `u=` alle|notizen|emails|anrufe|aufgaben|meetings; Aufgaben = Follow-ups der Person über `faellige` (kein zweiter Aufgaben-Weg); System (stufe/system/uebergabe) nur unter „Alle“ per Schalter; Zeiten in Europe/Berlin (`berlin()`); Meeting-Zeitpunkt seit H4 als Feld `wann`/`ort` (Altbestand: erste Textzeile, `meetingAusText`). **Anker** `akt-<hash>` (`ankerListe`/`aktivitaetAnker`, FNV über am|art|von|bezug, stabil gegen Textänderung), `akt-fu-<id>`, `akt-kal-<kontaktId>` — Sprung per `#anker`. Eigene Notizen ändern/löschen nur über `POST /api/crm/aktivitaet` mit `aktion: 'aendern'|'loeschen'`, `id`, `anker`, `stand` (H4, Logik `notizAnwenden`: nur Art notiz, nur `von` = angemeldete Person per `personStreng`, sonst 403; veralteter Stand → 409 mit aktuellem Kontakt). Die entfernte Fassung bekommt eine **Löschmarke** `Kontakt.geloeschteAktivitaeten` (`<anker>~<texthash>`, max. 500, `lib/crm/aktivitaet-marke.ts`) — `saeubereKontakt` wirft markierte Fassungen hinaus, `kontaktVereinen` nimmt nur die gespeicherten Marken (nie die aus dem Browser), so kommt nichts zurück und nichts doppelt. **Meetings** tragen `Aktivitaet.wann` (Tag bzw. `YYYY-MM-DDTHH:MM` Berliner Zeit oder ISO mit Zone, `wannSaeubern`) + `ort` (`ortSaeubern`); „+ Meeting“/Schnellaktion schreiben sie, der Text ist die Notiz; `meetingVon` liest Feld vor Text (Altbestand über `meetingAusText`) für „Kommend“ und Sortierung. Jede Antwort der Route trägt den Kontakt mit `stand`. Nichts wird verschickt.
- **Kontakt öffnen · Reiter Umsatz (28.09., H2, nur lokal):** `components/os/crm/kontakt/UmsatzReiter.tsx` (Props fest: `k`, `api`, `zuDeal?`), sechs einklappbare Kacheln (Merker `mt-umsatz-zu`): Umsatz · Zahlungsmöglichkeiten · Verträge · Angebote · Rechnungen · Zahlungseingang. Zuordnung und Kennzahlen NUR in `lib/crm/umsatz.ts` (rein): Mandate/Deals der Person + der Firma (`mandatZuFirma`/`dealZuFirma`), Rechnungen über `mandatId`, sonst per Name (`perName`, Hinweis „per Name zugeordnet“; eine Rechnung eines ANDEREN Mandats nie per Name; Privat nie), Einheit aus Mandat, sonst `Rechnung.firmaId`. Rechnungen schreiben nur über `PATCH /api/state/finanzplan` (`liste: 'rechnungen'`); „bezahlt“ nur über `PATCH { aktion: 'bezahlt', rechnungId, am }` — Status + Buchung `bu-re-<id>` in EINER Sperre (idempotent), wie die Finanzplanung. **Angebote** stehen NICHT als Rechnungsstatus im Finanzplan (die Liquiditätsvorschau zählte jeden fremden Status als sicheren Eingang), sondern in der Dateiablage (`art: 'angebot'`, auch ohne PDF) + abgeleitet aus Rechnungen mit `angebot`/`angebotAm` und Deals in/nach Stufe Angebot (`angeboteListe`).
- **Zahlungsdaten (28.09.):** `Firma.zahlung` bzw. `Kontakt.zahlung` (nur ohne Firma) vom Typ `Zahlungsdaten` (typen.ts), Säuberung/Anzeige `lib/crm/zahlung.ts` (`zahlungSaeubern`: IBAN nur mit gültiger Prüfziffer, SEPA-Daten nur bei SEPA, Link nur https). **IBAN nur maskiert zeigen** (`ibanMaskiert`/`zahlungFuerAnzeige`); jeder Weg nach draußen (Export, Heads, ZOE, Zusammenfassung) nimmt nie `zahlung.iban` — für neue Wege `zahlungOhneIban`.
- **IBAN serverseitig maskiert (28.09., H4):** Nichts an den Browser trägt die volle IBAN: `/api/crm/bestand` (Firmen) und jede Kontakt-Antwort über `fuerPerson` (GET/409 `/api/state/kontakte`, Aktivität, Dubletten, Anfrage, Netzwerk) liefern `zahlungMaskiert` (`iban` maskiert + `ibanGesetzt: true`). Speichern: maskiert/leer/ungültig = unverändert, nur eine neue gültige IBAN ersetzt, Entfernen nur mit `ibanEntfernen: true` — Firmen in `wendeCrmAn` (`ibanSchuetzen`, teil + upsert), Kontakte in der Kartei-Route (`teil` → `zahlungZusammenfuehren`, ganzer Eintrag → `ibanBehalten`). Ausnahme mit Kommentar: Auskunft Art. 15 (`fuerPerson(…, { ibanVoll: true })`) — die IBAN der Person voll, die der Firma maskiert. Neue Routen, die Kontakte/Firmen mit `zahlung` ausgeben: immer maskieren.
- **Dateiablage (28.09.):** `lib/dateien/regeln.ts` (rein: Typen, `dateinameSaeubern`, `typErkennen` am Inhalt, `metaSaeubern`, `eintraegeFuer`) + `lib/dateien/ablage.ts` (Server) + Route `app/api/crm/dateien` (GET Liste/`?id=` Download als attachment mit nosniff/CSP-Sandbox, POST multipart bzw. JSON für Angebote ohne Datei, PATCH Metadaten, DELETE). Inhalt unter `<daten>/dateien/<haushalt>/<id>.bin`, mit `MAKE_OS_DATEN_SCHLUESSEL` als Hülle `MKOSDAT1`+IV+Tag+AES-256-GCM (ohne Schlüssel lokal Klartext wie alles; gelesen wird nach dem Dateikopf); Metadaten im Bestand `crm-dateien--<haushalt>`. Nur PDF/PNG/JPG/DOCX, ≤ 15 MB (Body begrenzt gelesen), Kennungen nur `d-[a-z0-9-]`, jeder Eintrag braucht einen Bezug. Zugang: `imHaushaltDesInhabers` UND benannte Person mit Haushalt (`haushaltVon`) — Dienstweg ohne Person 403, mit Person nur deren Haushalt. `scripts/daten-verschluesselung.mjs` stellt die `.bin` mit um (Schlüssel rotieren). **Nie an KI/Agenten** — kein Werkzeug, kein Paket liest die Ablage.
- **Angebots-Tool (28.09., A1, nur lokal):** Liste `crm.angebote` (`Angebot` in typen.ts, Beträge in **Cent**), geschrieben NUR über `/api/crm/angebot` (`lib/crm/angebot-server.ts`; der allgemeine Bestand-PATCH lehnt `angebote` mit 409 ab — `regelnAbgelehnt` in speicher.ts). Regeln rein in `lib/crm/angebote.ts` (Summen je Satz über `lib/finanzen/ust.ts`, Nummern `{KURZ}-A-{JAHR}-{NR4}` je Gesellschaft und Jahr über `lauf`, Ablauf, Vorlagen Sie/Du, Deal-Wert, `mandatVorbelegung`, Personenbezug). **Gestellt = festgeschrieben:** Nummer + PDF (pdf-lib, `lib/crm/angebot-pdf.ts`, Aufbau `angebot-dokument.ts` = auch die HTML-Vorschau) + SHA-256 in EINER Sperre (`aendereCrmAsync`); PDF in der Dateiablage mit `angebotId` (fester Bezug, nur Server, `istBeleg` → nicht löschbar). Änderung nur als neue Version (`vorgaengerId`, alte → „ersetzt“). Stellen verbindet: Deal (vorhanden oder `dealAnlegen`) auf „angebot“, Follow-up `fu-<angebot>`, Aktivität am Kontakt, BEAN liest `crm.angebote`; angenommen → Deal gewonnen, `/api/crm/lead` aktion „mandat“ belegt aus dem angenommenen Angebot vor; abgelehnt → Grund Pflicht. Kanal-Ampel: Werbesperre/Einschränkung blockt (`ampelVorStellen`). Art. 17: Entwürfe weg, gestellte Personenbezug lösen (`angebotePersonOhne`). Oberfläche `components/os/crm/angebot/` (AngebotStart · Editor · Positionen · Vorschau · Ansicht · Liste · Blatt).
- **Gesellschaften (Absender, 28.09.):** `lib/crm/gesellschaften.ts`, Speicher `gesellschaften--<haushalt>` (nie im Code), Route `/api/crm/gesellschaften` (Haushalt des Inhabers + Person mit Haushalt, Stand/409, Logo nur PNG/JPG in die Ablage mit Bezug `gesellschaft`), Stammdaten › Gesellschaften. IBAN wie bei Kunden nur maskiert (im PDF voll). **Produkte:** `Leistung.angebot` (Leistungstext Pflicht für „aktiv“, Server 409; `produktAngebotFehlt`).
- **CRM-Schreibregeln (28.09. abends, Prüfung + R1–R4):** Kartei nur über `aendereKontakte`/`aendereKontakteAsync` (lib/crm/kartei-schreiben.ts, protokolliert ohne Werte; Test-Wache meldet direkte `updateJson('kontakte')` außerhalb der erlaubten Stellen). **Sperr-Reihenfolge immer crm → kontakte**: `aendereCrm` sperrt `crm` und darin `kontakte` (Lead-Folgen, Personen-Schranke Art. 18/Werbesperre in `lib/crm/personen-schranke.ts`); nie innerhalb einer Kartei-Sperre `aendereCrm` aufrufen. Browser: Kontakt-Schreibvorgänge nur über die Kette in `lib/crm/kontakt-schreiben.ts` (Stand aus der letzten Serverantwort), Meldungen über `FehlerHinweis` (bleiben stehen, `laden` löscht sie nicht). Zugang: `imHaushaltDesInhabers` ist beim Dienstweg streng (Person muss im Haushalt sein, ohne Person null); Systemläufe ohne Person nur über `imHaushaltOderSystemlauf` (Kartei lesen, Kalender/Erinnerungen vom Mac). ZOE-CRM-Werkzeuge nur mit Person im Haushalt. Dubletten: Vorschau `wasWandert` + Rückgängig (`lib/crm/zusammenfuehren-lauf.ts`). Löschen: `loeschSperren`/`loeschKaskade` (crm-stand.ts), Events nur über `POST /api/crm/events {aktion:'loeschen'}`. Art. 17 tilgt Namen in Deal-Titeln/Mandat-Kunde (`crmNamenTilgen`); neue Deal-Titel ohne vollen Personennamen.
- **Verbindungsprüfung (28.09., V1):** `lib/crm/verbindungen.ts` (rein: `verbindungenPruefen` → Befunde mit Schwere/Anzahl/Kennungen, `verbindungenReparieren` nur sichere Fälle, Katalog `PRUEFUNGEN`), Laden `lib/crm/verbindungen-laden.ts`, Route `app/api/crm/verbindungen` (GET ETag · POST `{ ids, vorschau }`, Haushalt des Inhabers + benannte Person), Karte Stammdaten › Datenqualität, Fehler auch in `lib/crm/befunde.ts`. **Jede neue Verknüpfung (neue Kennung, die auf eine andere zeigt) dort mitprüfen** — Prüfung + Satz in `PRUEFUNGEN`, Fall in `tests/crm-verbindungen.test.ts` (der Test verlangt je Prüfung einen Fall). Reparieren löscht nie Datensätze und fasst keine Zeitstempel an. Zahlen: `scripts/verbindungen-pruefen.mjs` (nur Kennung/Schwere/Anzahl).
- **Normalisierung (28.09., K2):** alle Normalisierer beginnen mit `.normalize('NFC')` (auch `csvLesen`). Schlüssel `schluessel` (lib/make-one/crm.ts): persönliche E-Mail (`mailSchluessel`: nur NFC/trim/klein — `-`, `_`, `+` bleiben) → HubSpot-ID → Name+Firma (`normName`/`normFirma`, „G.m.b.H.“/„GmbH & Co. KG“ erkannt); Sammeladressen (`istSammelAdresse`: info@, kontakt@, team@ …) nie als Personenschlüssel. EINE Telefonform `normTelefon` („+49…“) für Import und Dubletten. Suche überall `suchNorm`/`suchPasst` (lib/text/such-norm.ts) — keine eigene Such-Regel bauen. Übergang: `importieren` prüft nach dem neuen auch den alten Schlüssel (`schluesselAlt`, nur eindeutig, nicht doppelt, Namen verträglich) — bei einer künftigen Schlüsseländerung genauso verfahren. Datum aus Listen nur über `datumAusListe`.
- **Sperrliste (28.09., K2):** `lib/crm/sperrliste.ts`, Speicher `crm-sperrliste--<haushalt>` (Haushalt des Inhabers, `karteiHaushalt()`, Ersatz „haupt“) — nur SHA-256 der Merkmale (`identitaetsMerkmale`), Grund, Tag; nie Klartext. Einträge bei Werbesperre (Kartei-PATCH, Aktivität/Follow-up „Sperre“, vor jedem Import `sperrlisteNachtragen`) und Art. 17 (`personEntfernen`); `importieren(…, { gesperrt })` legt Gesperrte nicht an. Werbesperre aufheben nur per `teil` mit neuer Einwilligung + Nachweis (`sperreAufhebenPruefen`, sonst 409), System-Aktivität `sperreAufhebenVermerk`, dann `entsperren`; ein ganzer Eintrag hebt nie auf (`sperreBehalten`). Neue Wege, die `werbesperre` setzen: `sperren([k], 'werbesperre', tag)` rufen.
- **Import-Lauf (28.09., K2):** `lib/crm/import-lauf.ts`, Speicher `crm-import-laeufe--<haushalt>` — Vorher-Stand der geänderten + Kennungen der neuen Kontakte, abgelegt in derselben Sperre VOR dem Schreiben (`updateJsonAsync`), Fingerabdrücke nach dem Firmen-Abgleich; `POST /api/crm/import { aktion: 'rueckgaengig', laufId }` nur für seitdem unveränderte (neue: auch nicht verknüpft), sonst Konflikt; 30 Tage. Art. 17 räumt die Läufe (`laufOhne`). Server stempelt `geaendertAm`/`importiertAm`/`vonHand` (`serverStempel`); Aktivitäten/Einwilligungen nie kürzen (`AKTIVITAETEN_MAX` 10.000 / `EINWILLIGUNGEN_MAX` 500 → 413).
- **Personenbezug nur über `lib/crm/person-bestaende.ts` (28.09., F2)** — `personAufzaehlen` (Art. 15), `personEntfernen` (Art. 17, auch `op:'delete'` der Kartei), `personUmbiegen` (Dubletten) über alle Speicher; jeder neue Speicher mit Personenbezug gehört dort hinein. Archiv-Kopien nur über `lib/store/archiv.ts` (verschlüsselt wie die Bestände).
- **Stationen — Person in mehreren Firmen (28.09., U1):** `Kontakt.stationen?: { firmaId, rolle?, art?, von?, bis?, aktiv, haupt? }[]` (`lib/crm/stationen.ts`). `firmaId`/`firma`/`position` sind die ABGELEITETE Hauptstation (aktive mit `haupt`, sonst jüngste aktive) — alle alten Leser lesen weiter `firmaId`. Altbestand ohne `stationen`: `stationenVon` leitet beim Lesen eine aktive Hauptstation ab (ohne Schreiben); geschrieben wird nur, wenn die Liste mehr trägt als die alten Felder. Jeder Schreibweg der Kartei ruft `bezuegeSynchron` (lib/make-one/crm.ts = `mehrfachSynchron` + `emailsSynchron` + `stationenSynchron`) VOR `serverStempel`. **Firma ändern nur mit Absicht (Kevin 28.09.):** der `teil` trägt `firmaWechsel: 'jobwechsel'|'zusaetzlich'|'korrektur'` (nie gespeichert; die Route rechnet `firmaWechselAnwenden` → Stationen); ohne Absicht gilt „Korrektur“ nur ohne gespeicherte Stationen, sonst 409 `FIRMA_WECHSEL_FEHLT` (`firmaWechselFehlt`, auch für ganze Einträge) — nie endet still eine Station. Oberfläche fragt mit `useFirmaWechselFrage` (components/os/crm/kontakt/FirmaWechselFrage.tsx: Matrix-Feld „Firma“, Firmenkarte „+ zuordnen“); neue Schreiber, die nur `firmaId` ändern, schicken die Absicht mit; ein Eintrag ohne `stationen`/`emails` (älteres Fenster) verliert die gespeicherten nie; `null` im `teil` leert sie nie (nur ein ausdrückliches `[]`). Oberfläche: Kontaktseite rechts „Firma“ › Stationen (`components/os/crm/kontakt/StationenTeil.tsx`: Firma wechseln, + weitere Firma, beenden, Haupt, entfernen nur für Fehleinträge), Firmenkarte „Personen · aktuell“ / „Ehemalig“. Aktivitäten tragen beim Anlegen `firmaId` (Firma zum Zeitpunkt, `wendeAktivitaetAn`); die Zeitlinie einer Firma über `aktivitaetZurFirma` (Altbestand: Zeitraum der Station).
- **Regel: „Personen einer Firma“ nur über `personenDerFirma(kontakte, firmaId, { nurAktiv })` / `personenJeFirma` / `firmenDerPerson`** (lib/crm/stationen.ts) — nie `k.firmaId === f.id`. Leads, BEAN, Export, Segmente (Firmen-Kriterien über jede laufende Station), Verbindungsprüfung, Firmen-Abgleich (überspringt Kontakte mit gespeicherten Stationen), Löschsperre (zählt auch ehemalige), Heads, Kampagnen, Kollegen in der Akte.
- **Mehrere E-Mail-Adressen (28.09., U1, #11):** `Kontakt.emails?: { adresse, art?, haupt? }[]` (`lib/crm/emails.ts`), `email` = Haupt-Adresse (abgeleitet). Schlüssel/Import-Abgleich/Dubletten/Sperrliste (`identitaetsMerkmale`)/Suche fragen `alleAdressen`. Import: eine neue Adresse zu einer bekannten Person (Treffer über Adresse, HubSpot-ID oder eindeutig Name+Firma) wird als weitere angehängt (`adresseAnhaengen`, Ergebnis `weitereAdressen`), nie überschrieben; von Hand geleert → Konflikt. Zusammenführen (`lib/crm/dubletten.ts`) vereint Adressen und Stationen ohne Doppelte (früher „Weitere Mail: …“ in der Notiz). Oberfläche: Kontaktseite links alle Adressen mit Art, „Haupt“, ×, „+ Adresse“.
- **Typ, Kategorie, Labels mehrfach (28.09., U1):** `Kontakt.typen?`/`kategorien?`/`labels?` (`lib/crm/mehrfach.ts`), `typ`/`kategorie` = erster Wert (abgeleitet; ein alter Schreiber/Import ersetzt den ersten Wert). Fragen nur über `hatTyp`/`kategorieBeginnt`/`enthaeltEinenVon` — nie `k.typ === …`. Werteliste `labels` (nur eigene) unter Stammdaten › Wertelisten; Werte an Personen außerhalb der Wertelisten meldet die Verbindungsprüfung als EIN Hinweis `werte-ausserhalb-wertelisten` (`werteAusserhalb`), „In Werteliste aufnehmen“ legt sie über `wertelistenPruefen` als eigene Werte an (Befund trägt `knopf`); Chips über `WertelistenMehrfachWahl` (WahlMehrfach mit `onNeu`). Segment-Kriterien `typ`/`kategorie`/`label` („enthält einen von“), Kartei-Filter „Einordnung“, Export-Spalten `TYPEN`/`KATEGORIEN`/`LABELS`/`WEITERE_EMAILS`/`STATIONEN` (am Ende angehängt, „ · “ verbunden). Lifecycle, BEAN, Kreis bleiben Einzelwahl. Sichtbar heißt `besitzer` jetzt „Zuständig“ (nur Beschriftung), der Reiter `t=daten` „Stammdaten“.
- **Mutter- und Tochterfirmen (28.09., U1, #7):** `Firma.mutterId?` (`lib/crm/konzern.ts`: `firmenGruppe`, `toechter`, `muetter`, `kreisFirmen`). Säuberung: Form + nie sie selbst; `wendeCrmAn` → `mutterPruefen` (tote Mutter/Kreis → nur diese Änderung zurück, `fehler`); Löschsperre zählt Töchter; Verbindungsprüfung `firma-mutter-tot` (reparierbar) und `firma-mutter-zyklus`. Firmenkarte: Mutter wählen, Töchter, „ganze Gruppe“ für Deals & Mandate, BEAN der Gruppe als Anzeige (`beanGruppe`); Reiter Umsatz: Schalter „Ganze Gruppe“ (`umsatzBezug(…, { gruppe })`).
- **Datenschutz vollständig (28.09., U2, nur lokal — Hinweis, keine Rechtsberatung):**
  - **Einwilligung mit vollem Nachweis (#55):** `Einwilligung.zeitpunkt`/`erfasstVon`/`wortlaut`/`wortlautVersion`/`belegRef`/`widerrufenVon` (`lib/crm/einwilligung.ts`). Stempel setzt NUR der Server (`lib/crm/datenschutz-stempel.ts` `datenschutzStempeln` in jedem Kartei-Schreibweg): bekannte Einträge unveränderlich, Widerruf nur hinzu (Tag + Person), die Liste wächst nur (`einwilligungen` in `NIE_LEEREN`), neue Grundlage „einwilligung“ nur mit Wortlaut + Beleg (sonst 409, `pruefeDatenschutz`). Altbestand bleibt gültig, ist aber „Nachweis unvollständig“ → werbliche Mail/LinkedIn/Einladung gelb (`nachweisLuecken`). Neue Wege, die Einwilligungen anlegen, geben Wortlaut + Beleg mit (Vorbild `einwilligungUebernehmen`). Art. 15 listet sie eigens (`nachweisAuskunft`).
  - **Einschränkung Art. 18 als Sperre (#51):** `Kontakt.eingeschraenkt { seit, grund, von, antragId? }` (`lib/crm/einschraenkung.ts`). Setzen/Aufheben NUR `POST /api/crm/datenschutz { aktion: 'einschraenken' | 'einschraenkung-aufheben', id, grund }` (Antrag „einschraenkung“ mit Person setzt sie beim Anlegen). Wo bisher `k.werbesperre` jemanden aus Listen nahm, gilt **`ausgenommen(k)`** (Werbesperre ODER Einschränkung) — Ampel rot, Heads/ZOE/KI-Paket, Segmente, Kampagnen, Qualifizierung, Power Hour/Follow-ups, Signale, Netzwerk, Events; Export nur mit Spalte `EINGESCHRAENKT`, Suche mit Kennzeichnung. Bearbeiten 409 (Kartei, Aktivität, Notiz, ZOE, Import überspringt, Dubletten, Kampagnen-Ergebnis); erlaubt bleibt nur ein Werbewiderspruch. Löschen (Art. 17) erst nach dem Aufheben. Verbindungsprüfung `einschraenkung-kampagne` (reparierbar: herausnehmen) + `einschraenkung-einladung`.
  - **Löschfristen je Datenart (#52):** EINE Tabelle `lib/crm/loeschfristen.ts` (`LOESCHFRISTEN`, Standard nie gespeichert — nur Abweichungen im Bestand `crm-loeschfristen`, `fristenSpeichern`; Stammdaten › Datenschutz, `POST /api/crm/datenschutz { aktion: 'fristen' }`). Täglicher Systemlauf `loeschfristen` (Takt 0e, Tagesmarke `lauf.tag`, `lib/crm/loeschfristen-lauf.ts`): Personen NIE automatisch löschen — eine Aufgabe `loeschfrist-kontakte` ohne Kennung/Namen, Liste + „Frist verlängern mit Grund“ (`Kontakt.loeschfristVerlaengert`, `aktion: 'frist-verlaengern'`) in Stammdaten › Datenschutz; technische Bestände (Import-Konflikte, Import-Läufe, Heads-Replay, Signal-Texte, Änderungsprotokoll-Monate) bereinigt der Lauf mit Protokoll „System“. Signal-Aktivitäten gehören dem Server (`kontaktVereinen` nimmt die gespeicherte Fassung). `speicherbegrenzung` rechnet über `kontakteUeberFrist`.
  - **„Zuletzt geprüft“ (#34):** `Kontakt.geprueftAm/geprueftVon` (Server stempelt heute + Person aus `teil { geprueftAm }`), Knopf „Stammdaten geprüft“ in Kontakt › Stammdaten › Datenschutz; `lib/crm/geprueft.ts` `nichtGeprueft` (aktive Beziehungen/Leads, 12 Monate) → Datenqualität + Befund.
  - **Nachtrag (Kevin 28.09.):** Altbestand bleibt gelb, Fristwerte und Sofort-Sperre beim Art.-18-Antrag wie gebaut. **Newsletter-Ampel** grün nur mit vollem Nachweis des Double-Opt-in, sonst gelb mit Grund (Segment „Kanal grün“, Newsletter-Empfänger, Export `NEWSLETTER_DOI` folgen). Datenqualität-Karte „Einwilligung ohne vollständigen Nachweis“ (`nachweisOffen` in lib/crm/einwilligung.ts: je Kanal + Liste, Links in `kontaktAkte(id, 'daten')`, ohne Widerrufene/Anfragen/Gesperrte) + Befund — nur zum Ergänzen von Hand, nichts automatisch.
  - **Bestandskundenprivileg (#57):** Mail-Ampel grün über Mandat NUR mit `Kontakt.hinweisBeiErhebung { am, von }` (Person stempelt der Server), sonst gelb mit Grund. **Telefon mit Anlass (#58):** gelbe Telefon-Ampel → `/api/crm/aktivitaet` verlangt `anlass` (oder `notiz.anlass`), gespeichert an der Aktivität (`anlassPflicht` in recht.ts; Power Hour nimmt den Kartengrund, Follow-up-Erledigen den Follow-up-Text). **Ereigniszeit (#46):** `Aktivitaet.wann` für alle Arten (nie in der Zukunft außer Meetings), „letzter Kontakt“ = Tag des Ereignisses (nie zurück), Sortierung `ereignisMs` (`wann ?? am`). Tests `tests/crm-u2-datenschutz.test.ts`.
- **Listen im CRM-Bestand nie kürzen (28.09., U1):** `LISTEN_GRENZEN` + `crmGrenzen` in `lib/crm/speicher.ts` — über der Grenze lehnt `wendeCrmAn` die GANZE Änderung ab (413 mit Text); die Säuberer nutzen dieselbe Grenze nur als Sicherung (vorher still: Kampagnen-Ergebnisse 1.000, -Kontakte 500, Beitrags-Wirkung 200, Personen je Deal/Mandat 20, Checklisten 60 …). Import schreibt ins Änderungsprotokoll als `{ art: 'import', person }` (Kartei, CRM-Segment, Firmen-Abgleich).
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
  in Qualifizierung), ZOE `chance_anlegen` setzt den Lead auf SQL. Head-Block
  in allen Ansichten standardmäßig zugeklappt.
- **Markttraktion in der Praxis (25.09.2026 abends):** Erfassen ohne Reibung —
  Kanal-Chips sind Links (tel:/mailto:/LinkedIn, nur wenn die Ampel nicht rot
  ist), „Anrufen“ je Power-Hour-Karte, „Wie lief's?“ nach Kalenderterminen
  (`lib/crm/erfassen.ts nachbereitung`), Einwilligung im Gespräch mit Wortlaut
  (überschreibt keine vorhandene Rechtsgrundlage), „+ Gespräch festhalten“ von
  überall (`SchnellErfassen.tsx`), ZOE `notiere_kontakt` mit Ergebnis/Bedarf/
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
  - **Anbindung:** ZOE-Werkzeuge `crm_lage` und `chance_anlegen`. Der Head of Finance sieht MRR und die gewichtete Pipeline (nie im Basisplan).
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
  Takt in `lib/heads/takt.ts`, eingehängt in `lib/zoe/takt.ts`.
- **Eine Kasse (24.09.2026).** Business-Kasse = Summe der Firmenkonten
  (`geschaeftsKasse`/`mitKasse` in `finance-data.ts`); `finance.cash` nur
  Rückfall. Rest-Monate ab heute (Berlin). Keine zweite Runway-Formel bauen.
- **Selbstaufrufe nie über die Anfrage-Adresse (24.09.2026).** Routen, die
  andere Routen mit `x-make-key` aufrufen, nehmen `innenAdresse(req)` aus
  `lib/innen.ts` — nie `new URL(req.url).origin` (Vorbau Tailscale/Caddy,
  Schlüssel an fremden Host). Einladungslinks: `MAKE_OS_ADRESSE`.
- **Obsidian ist Wissensbank Nummer eins (24.09.2026).** `lib/zoe/vault.ts`
  liest `~/Desktop/MAKE/Make.Claude` zuerst, dann die iCloud-Doku. Es gelten
  Kevins Regeln aus dem Vault (`AGENTS.md`, `Vertraulichkeitsregeln.md`):
  `scope: privat` nie an Agenten/Hintergrundläufe und nie in Texte nach außen;
  Schreiben nur als Protokoll oder Anhang an `Offene_Fragen_Brain`,
  `Taskmanagement_Brain`, `Zoe_Log` — Fundament und Quellen nie, im Ordner
  MAKE wird nichts gelöscht. Seite `/os/wissen` mit Chat „Fragen“
  (`lib/zoe/brain-chat.ts`, nur lesend, antwortet nur aus Notizen mit Quelle),
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
  stehen nirgends sonst. ZOE findet die Notizen über `suche_wissen`.
  Achtung: der Vault liegt in iCloud — dort niemals Schlüssel ablegen.
- `BEWEGUNG.md` — die Bewegungssprache: 30 Punkte aus der Recherche vom 07.09.,
  jeweils mit Begründung.
- `ONBOARDING_MALIN.md` — Einstieg für Malin (mitbenutzen + mitbauen).
- `UMSETZUNGSPLAN.md` — Konzept; der lebende Bauplan liegt in der App
  unter `/os/bauplan`.

## Finanzplanung jetzt (27.09., nur lokal)
- **Speicher:** EIN Dokument je Haushalt `finanzen-plan--<haushalt>` (Kevin + Malin = ein Haushalt), Zugang nur über `haushaltVon`; Startbestand kommt per Upload (`POST /api/finanzplan/import`, ersetzen nur ausdrücklich) — echte Zahlen nie im Repo, nie in Tests.
- **Routen:** `GET /api/finanzplan` (ETag, `dokument: null` ohne Startbestand) · `?nur=kennzahlen` (verdichtet, für ZOE/Startfläche) · `PATCH { basisStand, ops }` — Operationen mit Pfaden (`/plan/<zeile>:<monat>`, Listen `id=…`, `/-` anhängen, fehlendes `neu` entfernt), Prüfung und Schreiben in EINER Sperre, 409 mit aktuellem Dokument bei fremdem Stand (`lib/finanzen/plan/{operationen,speicher}.ts`).
- **Rechenkern:** `lib/finanzen/rechenkern.ts` ist Kevins v3 und DIE eine Wahrheit der Rechnung — nie daneben rechnen; Steuern/Netto sind Näherungen (im UI „Hinweis, keine Steuerberatung“). Monat 1 = Okt 26, Historie Jan–Sep 26.
- **Oberfläche:** `/os/finanzplan` (`components/os/finanzplan/`, Eintrag in `EIGEN` unter Agenten): Blatt mit Excel-Bedienung, Wer-Strich aus den CRM-Teamfarben, Rückgängig lokal als Gegenoperation, Verbergen, Meldung nach jedem Speichern. Regel „merken“ (`/regeln/<empfänger>`) wirkt rückwirkend und ist nicht rückgängig-fähig.
- **Regeln:** Änderungen nur als Operationen (nie das Dokument zurückschreiben), Protokoll und Zellen-Meta schreibt der Server, `wer` = Speichername des Kontos. Plan/Stand/Abweichungen: `FINANZPLANUNG_JETZT.md`.
- **Szenario-Baukasten (27.09. abends):** `lib/finanzen/szenarien.ts` löst Bausteine (Umsatz = Produkt × Kunde × Preis × Menge × Rhythmus × Start × Laufzeit × Zahlungsziel; Kosten = Stelle/Software/Miete/Rate) und Szenario-Annahmen in Monatsreihen (`Zusatz`) auf und füttert den Kern — der Kern addiert nur, ohne Zusatz rechnet er wie bisher (nie im Kern interpretieren). Speicher: `planszenarien[]` + `arbeitsplan` im Plan-Dokument (Operationen wie sonst; fehlen sie, gilt der reine Treiber). `rechne()`/`kennzahlenVon()` rechnen immer mit dem Arbeitsplan. Produkte sind die eine Quelle der Umsatzbausteine (`lib/finanzen/produkte.ts`, nur lesen; `Leistung.preis.basis`, `laufzeitMonate`, `aufwand` in `lib/crm/typen.ts`); Route `GET /api/finanzplan/vorschlaege`. Navigation: acht Bereiche (Lage · Planen · Privat · Business · Gesamt · Buchungen & Check · Ziele & Töpfe · Protokoll), alte `?u=` lösen weiter auf.

## Tempo (27.09.)
- Tempo misst man im **Prüfbau** (`make-os-pruefbau`, Port 3011, `MAKE_OS_DIST=.next-pruefbau npx next build`) oder auf dem Server — nie auf 3001 (Entwicklungsmodus übersetzt jede Seite beim ersten Aufruf).
- **Prüfbau und Dev-Server teilen `.data` (28.09., K1 #40):** `make-os-pruefbau` (3011) und `make-os-entwicklung` (3001) lesen und schreiben denselben Datenordner — nie gleichzeitig schreibend benutzen (einen anhalten, bevor im anderen geklickt wird). `scripts/daten-verschluesselung.mjs` warnt, wenn auf 3000/3001/3011 eine App läuft.
- Der Live-Server hat **1 vCPU / 1,9 GB**: alles, was pro Anfrage rechnet, reiht sich hintereinander. Deshalb: keine externen Aufrufe (iCloud, Modell) im Seitenpfad, keine neuen Poller unter 30 s, jede große GET-Antwort mit `etagAus`/`unveraendert`/`jsonAntwort` (`lib/http/json-antwort.ts`).
- Der **Anfrage-Bündler** (`lib/http/anfrage-buendel.ts`) liegt vor dem Browser-fetch: gleiche GETs an /api teilen sich eine Antwort (laufend immer, fertig 8 s; `cache: 'no-store'` = nur laufend). Schreibende Aufrufe leeren ihn und zählen die Generation hoch (Start + Ende) — ein GET aus einer älteren Generation wird weder geteilt noch frisch gehalten. Wer wirklich frisch lesen muss, nimmt `no-store`.
- **Memo** merkt unter dem Stand vom START der Rechnung — wer während der Rechnung schreibt, macht das Ergebnis ungültig; eine ältere Rechnung überschreibt nie eine jüngere.
- **Memo-Rauschen** (`lib/store/memo.ts` RAUSCHEN): Bestände, die oft geschrieben werden, aber in keinen Index eingehen. Neuer Bestand mit hoher Schreibfrequenz? Dort eintragen, sonst ist der Zwischenspeicher der Indizes wieder nie warm.
- Embeddings laufen nur ab 3 CPUs (`embeddingsErlaubt`), Brain-Index-Abgleich alle 30 Min., Arbeiter höchstens 2 Läufe auf kleinen Maschinen.

## ZOE (27.09.)
- Der Assistent heißt **ZOE** (immer groß in Texten). Code: `lib/zoe`, `app/zoe`, `/api/zoe/*`, Bestände `zoe-*`. Alte `jarvis-*`-Dateien werden beim ersten Lesen übernommen (local-db); `/jarvis` und `/api/jarvis/*` leiten um — beides nicht entfernen, solange alte Arbeiter, Boten oder Lesezeichen leben.

### Lead-Score & Qualifizierungsrunde (27.09.)
- `lib/crm/score.ts`: `leadScore(personen, lead, heute)` → Punkte 0–100, Temperatur kalt/lau/warm/heiß, vier Teile mit Grund; `kanalVon(k)`, `kanalLeistung(zeilen)`. Nie speichern, immer ableiten — wie die Phase.
- Wärme verfällt (28.09., K4): „hat geantwortet“ (12) und „angesprochen“ (8) nach `WAERME_VERFALL_TAGEN` (180) nur noch 5 bzw. 3 — der warme Typ (10) schlägt Abgekühltes. `temperaturLeistung(zeilen)` = SQL-/Gewinnquote je Temperatur (ab `MINDESTMENGE`), Karte in Sales › Auswertung (`KanalLeistungLaden mitTemperatur`).
- `LeadZeile` (`lib/crm/leads.ts`) trägt `score`, `kanal`, `antworten`, `qualifiziertAm`, `ohneBesitzer`; `zuQualifizieren(zeilen, filter)` ist die Runden-Logik, `nichtKalt` filtert die Leads-Liste.
- Reiter `qualifizierung` (`components/os/crm/Qualifizierung.tsx`), Schreibwege über `/api/crm/lead` (`setze` mit `antworten`/`geprueft`, neu `uebernehmen`). Kalte Leads gehören ins Segment `seg-vernetzen` (Kriterium `temperatur`).
