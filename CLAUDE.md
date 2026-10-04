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
- **MAKE Innovation GmbH (seit 30.09., vorher „MAKE OS UG“/„Neue UG“)** = die Gesellschaft mit der Kennung `ug`
  (kurz „MAKE“). Kevin: „Ändere bitte überall in der Software MAKE UG in MAKE Innovation GmbH.“ Die Kennung `ug`
  bleibt überall (Daten, Spaces, FinanzOrt, Adressen, Code-Namen wie `rechneUG`/`steuerUG`); der Name steht NUR in
  `lib/einheiten.ts` (`UG_NAME`, `UG_KURZ`), Altnamen in `UG_ALTNAMEN` werden beim Lesen erkannt. Nicht verwechseln
  mit der KD Ventures UG (kdv) — die bleibt eine UG. Wächter: `tests/umbenennung-make.test.ts`.
- **Gesellschafts-Register (04.10., `lib/gesellschaften/`, Seite `/os/unternehmen` = Business › Unternehmen) — Regel „offene Liste“:**
  `Gesellschaftskennung` (kdc · kdv · ug) bleibt für alles, was RECHNET (Finanzen, Steuern, Rechenkern, Business-Index, Spaces);
  weitere eigene Gesellschaften tragen `g-<uuid>` (`GesellschaftId`/`istGesellschaftId`/`istRegisterKennung` in lib/einheiten.ts) und
  stehen nur im Speicher `gesellschaften--<haushalt>` (derselbe wie die Absender der Angebote — EIN Eintrag je Gesellschaft, alle neuen
  Felder optional IM Eintrag: Steckbrief, `gesellschafter[]`, `beteiligungen[]` (nur fremde Firmen), `vertraege[]`). „Hält“ wird aus den
  Gesellschafter-Einträgen abgeleitet, nie gespeichert. Auswahlen (Deals, Mandate, Produkte, Planung) nehmen die offene Liste
  (`GesellschaftWahl`, `gesellschaftWahl`, `registerEinheitenNamen`); Rechnungen nur über `finanzFirmaFuer` (g-… → null + `NUR_GRUNDDATEN`,
  nie still kdc). EINE Schreibstelle `lib/gesellschaften/server.ts` (Register- und Absender-Route), Stand/409, `bauPruefen`; Zugang nur
  Haushalt des Inhabers (Wächter „Sicht X bekommt nichts aus Y“ in `tests/gesellschaften-register.test.ts`); Cap-Table/Verträge nie in
  der Absender-Antwort. Vertragsfristen → Kalender (`vertragsFristenLesen`, Art `vertrag`), ZOE `gesellschaften_lesen` (frei, nur lesen).
  Keine Namen/Beträge/HRB im Code — der Haushalt trägt sie ein. Archiv = ruhend/aufgelöst bzw. ausgeschieden/beendet, Löschen = Papierkorb
  (ZeileAktionen), endgültig nur ohne Verweise; Morgenlauf-Schritt „Gesellschaften-Papierkorb“.
  Nachtrag 04.10. (Kevins Antworten): Rolle `operativ | holding` im Steckbrief — Holding-Sichten liest der Business-Index aus dem
  Register (`holdingSichten` → `Bestand.holdings` → `kennzahlenFuer(scope, holdings)`; `HOLDING_VORGABE` nur, solange keine feste Gesellschaft
  eine Rolle trägt). Organe (`organe[]`: Funktion, Person/Kontakt, seit/bis) und Beschlüsse (`beschluesse[]`: Datum, Art, Titel, Inhalt,
  Status, Unterlagen) als Listen je Gesellschaft (Reiter „Organe & Beschlüsse“). Erinnerung vor „kündigen bis“: `Vertrag.erinnerungTage`
  (Vorgabe 30, 0 = keine) → `vertragsErinnerungen` (Aufgabe `vte-…` + Meldung Art `vertrag` an den Haushalt, idempotent) im Morgenlauf und
  nach jeder Vertragsänderung. Neue Gesellschaften im Finanzplan: bewusst nicht (Kevin).
  Gründungsfahrplan: Vorlage `lib/gesellschaften/fahrplan.ts` (Ziel + 9 Meilensteine mit `wartetAuf` + Aufgaben), Karte im Steckbrief
  (`components/os/unternehmen/Fahrplan.tsx`), nur über die bestehenden Planungs-/Aufgaben-Schreibwege, feste Kennungen `z-fahrplan-…`/`ms-fahrplan-…`.
- **Malin ist Gesundheits-Beauftragte** (Sport, Ernährung, Hyrox-Pro-Ziel) —
  Gesundheitsthemen laufen über sie.
- **Kritisch pulsiert:** Priorisierung nach Eisenhower; kritische Aufgaben
  werden im System visuell pulsierend hervorgehoben.

## Plattform-Regel (Kevin, 01.10.2026) — immer mitdenken und so bauen
MAKE OS wird ein Produkt für **AI CEOs** (eigene Instanz je Kunde, Plan: `PLATTFORM_PLAN.md`); **Markttraktion muss
immer auch einzeln verkaufbar sein**. Kevin: „Sofort so bauen, dass wir ein richtiges Tool daraus machen können. Immer
mitdenken und bauen.“ Für jede neue oder geänderte Stelle gilt daher:
- **Nichts Persönliches fest einbauen:** keine neuen `'kevin'`/`'malin'`-Sonderfälle, keine festen Firmen, keine privaten
  Inhalte (Gesundheit, Nordstern, Namen) in Code, Prompts oder Standards — Werte aus Einstellungen/Beständen der Instanz
  (Personen über die vorhandenen Listen, Firmen über `lib/einheiten.ts`/Gesellschaften). Bestehende Sonderfälle beim
  Anfassen neutralisieren, wenn es klein geht; sonst im Bericht nennen.
- **Modular:** Markttraktion (CRM, Kampagnen, Events, Angebote, Kennzahlen) darf nur über klare Schnittstellen an andere
  Bereiche (Kalender, Aufgaben, Finanzen, ZOE) andocken — so, dass eine Instanz „nur Markttraktion“ zeigen kann.
- **Instanz-fähig:** Adressen, Domains, Namen, Schlüssel kommen aus der Umgebung/Einrichtung, nie fest im Code.
- **Zeigbar:** Alles muss mit erfundenen Beispieldaten (Demo-Instanz) vorführbar sein, ohne echte Daten.
- **Trennung serverseitig, nie nur versteckt (Kevin 04.10.: „absolut wichtig, immer wieder mit reinnehmen — wir müssen
  uns zur Software entwickeln, die wir verkaufen können“):** Sichten (Privat/Business), Rollen (Inhaber, Partner,
  Teammitglied), Haushalte und Gesellschaften werden auf dem SERVER gefiltert — die Antwort enthält nur, was die Sicht
  sehen darf (eine reine, getestete Filterstelle je Bereich); Schreiben auf fremde Pfade → 403. Die Oberfläche blendet
  nie bloß aus. Jedes neue Feature mit Wächtertest „Sicht X bekommt nichts aus Y“.
- **Testkunden nie auf unserer Instanz** (Kevin: „dürfen nie unsere Daten sehen, sollen aber ihren eigenen Space aufbauen
  können“): keine fremden Konten auf app.makeinnovation.de anlegen; Testkunden bekommen eine eigene Instanz (eigener
  Container/Datenordner/Schlüssel/Adresse). Neues immer so bauen, dass eine leere Instanz sauber startet.

## Eiserne Regeln
1. **Privates bleibt hier.** Gesundheits-, Journal- und Finanzdaten gehören
   Kevin & Malin. `.env.local` und `.data/` sind gitignored und bleiben es —
   niemals Schlüssel oder echte Daten committen oder in Code schreiben.
2. **Rohbau-Regel:** An Dritte (z. B. Alex/KEMARIS) geht nur Code, Struktur
   und Regeln — niemals Daten. Das Repo ist genau so geschnitten.
3. **Human-in-the-Loop:** Nichts verlässt das System Richtung Dritter ohne
   Freigabe von Kevin oder Malin. Interne Buchführung (Erfassungs-Werkzeuge) darf direkt schreiben.
   In den Kalender schreibt ZOE NUR über den Stapel (Kevin 29.09., F2 M8): `plan_block` ist freigabepflichtig
   (Gruppe „kalender“), erst der Klick legt den Block über `blockAnlegen` an.
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
   Projekt-/Aufgaben-Dateien liest ZOE (gekapselt, ≤ 30.000 Zeichen je Aufruf); seit 28.09. (C7, Kevin) auch CRM und CRM-Ablage —
   nur für Personen im Haushalt, gekapselt, mit den Leitplanken Art. 18 · private Notizen je Person · IBAN maskiert (Abschnitt „ZOE fürs ganze CRM“).
   Keine echten Namen Dritter im Code oder in `public/` (Klickdummys liegen in `prototype/`).
7. **Interne Hops tragen die Person:** Jeder `fetch` auf eine eigene Route mit `x-make-key` gibt
   `x-make-person` mit (aus `personAus(req)` bzw. dem Lauf) — ohne Person gilt der Aufruf als Systemlauf
   des Takts. Neue Routen mit Modellaufruf: `modellSchranke(req)` zuerst; große Bodies: `zuGross(req, n)`.
   Inhaber-Dinge (`nurInhaber`): Mac-Postfach/-Kontakte, Whoop/OAuth, Agenten-Regler, Postfach-Spiegel.
8. **Zweiter Faktor** (`lib/zugang/totp.ts`, RFC 6238, Route `/api/konto/zwei-faktor`): Konto-Feld
   `zweiterFaktor` (Geheimnis, letzte Stufe, Wiederherstellungs-Hashes) — nie in Antworten (`oeffentlich()`
   liefert nur `zweiterFaktorAn`). Anmelden: Passwort → `{ zweiterFaktor: true }` → Passwort + `code`.
   Cookie heißt in Produktion `__Host-make-os-sitzung` (SITZUNG_COOKIE), Server-Admin: `ssh make@… sudo`.
8a. **Mehrere Anmelde-Adressen (03.10.):** `Konto.email` = Hauptadresse (Anzeige überall, alte Bilder lesen nur sie), optional `weitereEmails` (≤ 3, `MAX_WEITERE_EMAILS`, nie ein Pflichtfeld — ohne Adressen fehlt das Feld ganz). „Adresse → Konto“ NUR über `kontoMitAdresse`/`kontoZuEmail` (`lib/zugang/konten.ts`), nie `k.email === …`; Eindeutigkeit über `adresseVergeben` (Konten + offene Einladungen mit `email`) innerhalb der `aendereKonten`-Sperre. Anmelde-Bremse: Paar `paar:<ip>|konto:<speicher>` (je Konto, nicht je Text), IP-Bremse und 2FA-Bremse bleiben. Ändern nur über `POST /api/konto/adressen` (`hinzu`/`haupt`/`weg`): aktuelles Passwort (Bremse `pw:<person>`), nur die Person der Sitzung (Dienstweg 403), Hauptadresse nie entfernbar, Protokoll (`anmeldungen` mit `detail` = `adresseMaskiert`) + Glocke (`art: 'sicherheit'`, Titel nur maskiert). Oberfläche `components/os/AnmeldeAdressen.tsx` (Konto-Kachel „adressen“). Tests `tests/konto-adressen.test.ts`. Rückweg: vorher die gewünschte Adresse zur Hauptadresse machen (GO_LIVE_CHECKLISTE).
9. **Bestände verschlüsselt** (`lib/store/local-db.ts`, Hülle in `lib/store/huelle.mjs`): mit `MAKE_OS_DATEN_SCHLUESSEL`
   (bzw. `…_DATEI`) liegt auf der Platte nur eine Hülle. **Welche, entscheidet `MAKE_OS_FORMAT` (29.09. abends):** Standard
   (ohne Variable) „kompatibel“ = v1 `{ __verschluesselt: 1, iv, tag, daten }` wie der alte Online-Stand aeb4964, Dateiablage
   „MKOSDAT1“, kein `_v`, Sperrliste neue Einträge v1+v2 ohne Umrechnung — der Rückweg zum alten Stand bleibt offen (HOI gelb).
   `v2` = Hülle `{ __verschluesselt: 2, kid, iv, tag, daten }` mit AAD =
   Bestandsname (gelesen werden immer beide; einzige Ausnahme: `jarvis-…` ↔ `zoe-…` gelten als gleichwertig — `aadAlternativen`,
   eine so gelesene Hülle wird mit dem richtigen Namen neu geschrieben; jede weitere Umbenennung von Beständen muss
   ebenso neu verschlüsseln, nie nur `rename`); Lesen ohne/mit falschem Schlüssel wirft (nie null), Klartext bei gesetztem Schlüssel
   auch (`KlartextBestand`, nur `MAKE_OS_KLARTEXT_MIGRATION=1` lässt ihn einmal durch). Wer `.data`-Dateien direkt liest,
   nimmt `rohOeffnen(roh, bestandsname)`. Umstellen/zurück: `scripts/daten-verschluesselung.mjs` (bricht bei laufender
   App ab); Rotation im Betrieb: `deploy/datenschluessel-rotieren-live.sh`. Tests biegen den Ordner mit `MAKE_OS_DATEN_DIR` um.
   Hüllen NIE direkt mit `huelleSchreiben`/`binSchreiben` schreiben, sondern mit `huelleImModus`/`binImModus` (Format des
   Modus); „schon aktuell?“ über `huelleAktuell`/`binAktuell`. Umstellen auf v2 = `.env` `MAKE_OS_FORMAT=v2` +
   `docker compose up -d` + optional Skript `--verschluesseln` bei angehaltener App (DEPLOY.md › Schreibformat, NOTFALL.md);
   danach ist der Rückweg zum alten Stand nur noch per Sicherung. Tests laufen im Format v2 (`vitest.config.ts`), den
   Standard prüft `tests/format-kompatibel.test.ts` (mit dem wörtlich übernommenen Lesecode von aeb4964).
10. **Kartei-Zugang & Änderungsprotokoll (28.09., K1):** `/api/state/{kontakte,kunden,prospects,netzwerk,stammdaten,aenderungen}`
   nur über `karteiZugang` (Haushalt des Inhabers; Dienstweg mit Person nur für eine Person dieses Haushalts). Das
   Änderungsprotokoll schreibt nur der Server (`lib/store/aenderungsprotokoll.ts`, Monatsdateien, nur anhängend, nie
   Werte, Kontakt-Kennungen als Fingerabdruck `c2#…` (HMAC mit Pepper; alt `c#…`)) — neue Schreibwege über `listePatchen`/`aendereCrm` oder `protokolliereBestand`.
   Änderungslisten nie still kürzen (`opsFehler` → 413). Kein SEED mit echten Namen/Beträgen (`tests/repo-sauber.test.ts`).
11. **Team nur aus `team--<haushalt>`, nie im Code (28.09., U4):** Leser holen es über `teamVon`/`teamFuerPerson`/`teamFuerAnfrage`
   (`lib/make-one/team-speicher.ts`) bzw. `useTeam` (`GET/PATCH /api/team`); Prompts bekommen die Namen zur Laufzeit. Kevin und Malin
   kommen aus den Konten. `lib/make-one/team-data.ts` = nur Rollen-Platzhalter als Rückfall (leerer Speicher, Tests).

## Sicherheit & DSGVO — Prüfung S1 (29.09., nur lokal)
- **Kalender je Person, auch im Altweg:** GET `/api/apple-calendar` liefert Rohdaten NUR dem Systemlauf ohne Person
  (Mac-Zulieferer); jede Person bekommt `cacheFuerPerson` (lib/kalender/zoe-sicht.ts, Regel wie `fuerZoe`: privat und
  Gesundheit der anderen → „Belegt“). Leser für Modelle nehmen `termineFuerZoe` (auch Tagesstart). `terminFremd` erkennt
  Buchungstermine zusätzlich an der UID `makeos-buchung-…`. GET `/api/kalender`: Apple-Erinnerungen nur für den Inhaber,
  private Fristen nur mit Haushalt (`fuerPersonFiltern`).
- **Tore:** `/api/zoe/stapel`, `/api/planung/vorschlag`, `/api/loop` = `imHaushaltDesInhabers` (403), `/api/zoe/takt` =
  Dienstweg oder Haushalt. Personlose (System-)Vorschläge sieht/entscheidet nur der Haushalt (`vorschlagSichtbar`);
  ausgeführt wird als die benannte Person. `bauPruefen` auch in crm/followup, crm/signale, crm/verbindungen (Reparieren),
  crm/datenschutz, heads/[head], familie, zoe/stapel, brain/app.
  Nur von Hand (Dienstweg → 403): Buchungs-Verwaltung (Seiten, Freigabe, Mail-Link, Gast-Rechte), Übernahme
  (`ausfuehren`/`erneut`/`zuruecknehmen`), Spiegel-Löschen (`/api/kalender/spiegel` `loeschen`).
- **Kein Rückfall auf „kevin“** (Regel 5) mehr in kimmi (400 ohne Person), zoe/stapel, state/zeit, planung/vorschlag, loop,
  `freie_zeit`/`bauplan_notieren`, kalender/termin (ohne Kalender/`wer` → 400), tasks/create (Systemlauf ohne `owner` → 400);
  interne Hops (Tagesstart, Tageslauf, Eingang) tragen nur `personStreng`. Offen (dokumentierte Systemläufe): `personAus`
  in Lese-Routen und `resolveVitals`/`gatherBrain`-Standard.
- **Nie still kürzen:** tasks/create (Titel 300, Einheit 40, Beschreibung 4000), crm/followup (Text 300, Notiz 1000 auch
  zusammen mit der alten Notiz), familie (200 Ops) → 413.
- **ZOE-Gespräch:** „fremd gelesen“ gilt fürs ganze Gespräch (`verlaufFremd` über `ran` im Verlauf); `notiz_ergaenzen` wie
  `notiz_anlegen` immer über den Stapel.
- **Kein Gesundheitskontext im Code:** Prompts nennen keine Diagnosen/Beschwerden einer Person. Optional
  `eigenerGesundheitsKontext(person)` (lib/gesundheit/kontext.ts) aus dem EIGENEN Ernährungs-Profil der fragenden Person
  (`bedarf`, `ziel`), als `<eigene_angaben>` mit `KONTEXT_REGEL` — nie für die andere Person. Wächter in tests/sicher-s1.test.ts.
- **Buchung (Datenschutz):** EINE Rechtsgrundlage Art. 6 Abs. 1 lit. b; das Häkchen ist „Kenntnisnahme Datenschutzhinweis“
  (Feld heißt weiter `einwilligung`, CRM-Nachweis `KENNTNISNAHME_NAME`). Hinweistext `datenschutzHinweis(fristen)` mit den
  wirksamen Löschfristen (`hinweisFristenLaden`: buchungen, kontakte, kalender-caches), Fassung `hinweisFassung` trägt sie.
  Hinweis, keine Rechtsberatung — Text einmal anwaltlich gegenlesen. Honigtopf und Zeit-Fehler: ein Text
  (`NICHT_ANGENOMMEN`); höchstens `GRENZEN.vorlaeufigJeSeite` (5) vorläufige je Seite; `/buchen/<slug>` gedrosselt
  (`buchung-seite:`) und Titel 30 s gemerkt. Verwaltung (`/api/kalender/buchung`): Dienstweg → 403 für Seiten, Freigaben,
  Mail-Link, Gast-Rechte; Protokoll `werAus(req)`; Seiten nur mit `stand` (= `geaendert`, sonst 409), `seite.person` im
  Haushalt, Körper ≤ 64 KB (413). Gäste OHNE Kontakt: `buchung-auskunft` / `buchung-loeschen` (Rückfrage, optional
  Name/Gastzeilen im Apple-Termin entfernen, sonst `inApple`); mit Kontakt → 409, über die Akte.
- **Art. 15** (`personAufzaehlen`): zusätzlich Buchungen (ohne Token-/Link-Hash), Termin-Bezüge, Meetings (ohne Wortlaut
  Dritter), Termin-Follow-ups — lib/crm/person-auskunft-kalender.ts.
- **Kalender-Wiederherstellung** prüft jede fehlende .ics gegen die Grabsteine (Adressen → `grabsteinTrifft`): gesperrt,
  im Probelauf `grabstein`. **CRM-Signale:** private Termine ohne Bezug gehen nie über den Titel ins CRM.

## Design & Produkt
- Design-Sprache: Klar·DARK — Token in `lib/make-one/os-data.ts` (THEME),
  Petrol `#21B5AA` als Akzent. Motion-Sprache in `app/globals.css`.
- **Keine Untertitel/Hinweise hinter Namen** — Namen stehen allein.
- Startseite heißt „Dashboard". Interne Navigation immer `next/link`, nie `<a>`.
- Charts: die drei Teals (health/planning/finance) nie gemeinsam als Serien —
  Finanzen im Chart = Kupfer `#DE9E63`.
- **Design-Standard (03.10., Kevin: „Den Standard von Netzwerken überall reinbringen“) — `DESIGN_STANDARD.md` ist verbindlich:** gemeinsame
  Bausteine in `components/os/ui` (ein Import `from '../ui'`: `Seite`, `Karte` gehoben/flach/`ton`, `Knopf` mit `haupt`, `Pillen`/`Segmente`/`Reiter`,
  `Hinweis art=gut|achtung|kritisch|info`, `Leerzustand`/`Leer`, `Kennzahl`/`Zahl`+`Raster`, `Zeile`, `eingabe`/`feld`), Token `ZIEL`/`ECKE`/`RAND`/`FLAECHE_STIL`/
  `BEDEUTUNG_FARBE` in `lib/make-one/design.ts` — keine Literale in Seiten. Eine Hauptaktion je Ansicht (48 px), Ziele ≥ 44 px, Eingaben 16 px am Handy,
  Hinweise als Karten nach Bedeutung, Leerzustand mit Symbol + Satz + Weg, Fließtext ≥ 13 px (11 px nur als Beschriftung in Großbuchstaben). `.ui-seite` fängt Altbausteine
  am Handy ab (globals.css, nur unter dem Anker — nie ein Seitenhammer). Umgestellt: **Netzwerken, Markttraktion (alle Reiter), Zahlen & Finanzen (51 Dateien, Wächter `tests/design-finanzen.test.ts`), Kern = globale Shell + Aufgaben + Kalender + Inbox (Wächter `tests/design-kern.test.ts`, Bausteine `HakenZiel`/`SymbolKnopf`/`ZielChip`)**; als Nächstes der Rest —
  Rezept „Umstellen einer Seite“ steht im Dokument (Import `../schlank` → `../ui`, gleiche Namen). `schlank.tsx` ist nur noch Quelle für `components/os/ui` (seit 04.10. hängt jede Seite am Standard). Wächter `tests/design-standard.test.ts`.

- **Aufräumen (04.10., Branch `aufraeumen`, nur lokal) — ein Weg statt zwei:** Keine Seite liegt mehr außerhalb von `/os`, `/zoe`, `/anmelden`, `/buchen`, `/api`
  (plus reine Weiterleitungen `app/page.tsx`, `app/jarvis`). Die Alt-Gruppe `app/(dashboard)` (eigene Leiste, Stubs, Beispieldaten, CommandPalette) ist samt
  allem, was nur sie nutzte, entfernt (components/layout, tasks, shared, dashboard, fundament, components/ui, context/MakeOS-/App-/PrivacyContext, lib/mock-data,
  lib/constants, lib/utils); alte Adressen leiten in `next.config.mjs` weiter (`/dashboard` → `/os`, `/tasks` → `/os/aufgaben`, `/wellness` → `/os/gesundheit`,
  `/routines` → `/os/planung/routinen`, `/groceries` + `/dog` → `/os/familie`). `/os/okr` leitet in Ziele & Planung (der OKR-Agent bleibt über ZOE, `/api/okr`).
  **Kein Import aus `schlank.tsx` mehr** außer `components/os/ui` selbst (reicht Ring/Balken/Punkt/Haken/Spalten/useHochzaehlen durch). Wächter
  `tests/aufraeumen.test.ts` (Routen, Weiterleitungen, Stapel-Link, OKR) und `tests/design-standard.test.ts` › Aufräumen.

- **Design-Standard · Privat/ZOE/System (03.10.):** Gesundheit (mit Sport, Journal, Routinen), Familie & Partnerschaft, Kompass, Brain, Privat-Übersicht, Home, Wachstum,
  ZOE (Empfang, Stapel, Agenten, Loops, HOI), Konto, System, Verbindungen, Datenbasis, Stammdaten hängen an `components/os/ui` (Wächter `tests/design-privat.test.ts`).
  Neu: `ZielBezug bereich=…` (ruhiger Chip „zahlt ein auf <Jahresziel>“, Auswahl rein in `lib/make-one/ziel-bezug.ts`, Farbe über `zielFarben`; je Aufgabe bleibt `ZielChip`)
  und `Schalter` (Tippfläche 56 × 44). Umschalter im Inhalt statt im Kopf, Konto-Felder mit Beschriftung (`.konto-feldreihe`), Einzelfelder mit Speichern = `<form>` (Enter).

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
- **Öffentliche Pfade (29.09., K4):** ohne Sitzung offen sind nur `/anmelden`, `/api/konto/{status,anmelden,einrichten,beitreten}`, `/api/hoi/csp` (POST) und die Buchung: `/buchen/<slug>(/status)` + `/api/buchung/<slug>(/status)` mit `<slug>` = `[a-z0-9-]{1,40}-[a-f0-9]{24}` (`BUCHUNG_OFFEN` in `middleware.ts`, Test `tests/buchung-middleware.test.ts`). Diese Wege handeln nie als Person (Köpfe gelöscht), drosseln je Adresse selbst (`buchung:`/`buchung-status:` in `lib/zugang/drossel.ts`), prüfen Honigtopf, signierten Formular-Stempel (≥ 3 s, ≤ 2 h), Größe (8 KB/1 KB → 413) und zeigen nur freie Zeiten. Eigene Köpfe in `next.config.mjs` (`buchung`: strengere CSP ohne Rahmen/Worker/Medien, `Referrer-Policy: no-referrer`, `Permissions-Policy` ohne Kamera/Mikrofon, `noindex`, `no-store`). Caddy (`deploy/caddy/Caddyfile`, U1 N1) setzt Referrer-/Permissions-Policy nur als Vorgabe (`?`, die App gewinnt) und für `/buchen*` + `/api/buchung*` ausdrücklich dieselben strengen Werte — nie wieder allgemein überschreiben. Neue öffentliche Wege nur so: eng gefasste Regex + eigener Test.
- **Härtung:** `deploy/server-haerten.sh` (SSH nur Schlüssel, fail2ban, ufw, Auto-Updates
  mit Reboot 04:30, Docker-Log-Grenzen, sysctl), Login-/Code-Drossel (`lib/zugang/drossel.ts`),
  Sicherheits-Header (`deploy/caddy/Caddyfile`), Schriften selbst mitgeliefert (`app/schriften`).
- **Sicherung:** nachts 03:15 verschlüsselt auf dem Server (`deploy/sicherung.sh`: age, ohne age openssl-Übergang mit HOI rot, nie unverschlüsselt; einzelne unlesbare Dateien → Archiv trotzdem, „teilweise“; Generationen 14/8/12)
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
- **EIN Kalender (seit 29.09., K5):** Kopf-Knopf „Kalender“ → `/os/kalender` (Woche, `?space=`); der frühere
  Wochenplaner ist dort der Modus „Planen“ (`?modus=planen`), `/os/planung/woche` und `/os/woche` leiten dorthin um
  (`WEG.woche(tag)`), das Alt-Dashboard `/calendar` (Beispieldaten, `CalendarContext`) ist weg. Details: Abschnitt
  „Kalender — Ein Kalender“ unten.
- Server spricht CalDAV mit iCloud: `lib/kalender/` (zeit, dav, ics mit ical.js, icloud,
  eintraege, zugang, einstellungen), API `app/api/kalender` (+ `/termin`). Geschrieben wird NUR über `/api/kalender/termin`
  (Browser) bzw. `lib/kalender/termin-server.ts` (Server); `/api/apple-calendar/{create,termin}` antworten 410. GET
  `/api/apple-calendar` bleibt nur für den Mac-Zulieferer/Abgleich-Anstoß (liefert `calendar-cache` UNMASKIERT — Oberflächen
  lesen `/api/kalender`). Der Abgleich schreibt `calendar-cache` für die übrigen Server-Leser (ZOE, Morgenlauf; K6).
- Zugang: `ICLOUD_APPLE_ID`/`ICLOUD_APP_PASSWORT` (app-spezifisch) NUR in der Server-.env —
  einrichten/trennen mit `deploy/icloud-verbinden.sh <apple-id>` (Kevin, per `ssh -t`; fragt nur das App-Passwort). Zugangsdaten
  gehen nur an *.icloud.com. Nach abgelehnter Anmeldung erst nach 30 Min. neu (Apple sperrt sonst).
- **Termine mit Gästen (seit 30.09., K3 — ersetzt „nie mit Teilnehmern“):** Serien ändert MAKE OS weiter nicht („in Apple
  ändern“). Gäste gibt es nur nach Klick: **Organisator = wir** (ORGANIZER = Adresse des iCloud-Kontos): Einladen, Ändern,
  Gäste ändern und Löschen erst nach der Rückfrage „Einladung/Änderung/Absage an n Personen über iCloud senden?“ (mit den
  Adressen) — iCloud verschickt. **Wir sind Gast**: nur Zusagen · Vielleicht · Absagen (PARTSTAT), ebenfalls nach Klick;
  Titel/Zeit nie. Ohne `einladungBestaetigt: true` schreibt KEIN Weg ein ATTENDEE oder ändert/löscht einen Termin mit Gästen
  (409, `lib/kalender/icloud.ts` — gilt für jeden Schreiber); der Dienstweg (ZOE, Takt, Skripte) darf nie einladen (403).
- Sehen darf den Kalender nur der Haushalt des Inhabers (+ Dienstweg), kein anderes Konto.
- **Google (seit 03.10.):** Business-/MAKE-Termine liegen im Google Kalender der Person (Abschnitt „Kalender — Google Workspace“ unten); iCloud bleibt für Privat, Familie, Gemeinsam und den Plan.
- Apple-Erinnerungen gibt iCloud nicht per CalDAV heraus — die kommen nur, wenn der Mac
  zuliefert (`zulieferer.mjs`); den Kalender vom Mac nimmt der Server nicht mehr an.

## Business-Index (seit 25.09.2026)
- Business-Index mit eigenen Zahlen: Finanzielle Gesundheit 50 · Personal 30 (bis 04.10. „Unternehmer-DNA“,
  Kennung `ud` bleibt) · Markttraktion 20 (arithmetisch), dazu Fokus & Zeit 10 % (die drei skaliert ×0,9) und seit 04.10.
  Kapazität 15 % (alle übrigen ×0,85, zählt nur mit Messung — Abschnitt „Kapazität“) — Text
  überall aus `SAEULEN_TEXT` (lib/business/register.ts). Nur Struktur + Standard-Kennzahlen übernommen — kein Code,
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
- **Einheiten-Regel (27.09.):** Business-Einheiten nur aus `lib/einheiten.ts` (Kern: Selbstständigkeit · KD Ventures · MAKE Innovation GmbH =
  kdc · kdv · ug) + `lib/planung/einheiten.ts` (Werteliste je Haushalt) — nie eigene Listen oder Schreibweisen.
- **Finanzen: EINE Einheitenliste (28.09.):** `FinanzOrt = 'privat' | kdc | kdv | ug` + `FINANZ_ORTE`/`GESELLSCHAFTEN`/`finanzOrtName`/`finanzOrtAus` (Altwerte)/`firmaAusAngabe` (ZOE) in `lib/einheiten.ts` — Cockpit (Sicht `ug`), Steuern, Baukasten, Privat-Finanzen, Buchungen-`ort`, ZOE, Kontaktakte nutzen nur diese. Selbstständigkeit = eigene Achse **auch im Rechenkern (seit 02.10., Kern-Umbau: `rechneSelbstAchse`, `Zusatz.kdc*`; `kernKanal` gibt es nicht mehr)**, Kern-Name `selbststaendigkeit` ↔ kdc nur über `finanzOrtAusKern`/`kernEinheitAus`. Steuern: MAKE Innovation GmbH (ug) sichtbar, aber ohne Fristen/Schätzung (`UG_NICHT_HINTERLEGT`, `STEUER_FIRMEN` = kdc/kdv). Privat-Finanzen: Dateien ohne Marke `einheiten: 2` sprechen das alte Vokabular (`ug` = KD Management UG = **kdv**!) und werden beim Lesen übersetzt (`einheitenLesen`, `haushaltEinheitAusAlt`), geschrieben wird die neue Fassung; Eingaben über `einheitAus` (neues Vokabular). Summen-Regression: `tests/finanz-einheiten-summen.test.ts`.
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
- **Zeitstrahl & Planungsjahr (30.09.):** Rechnung rein in `lib/planung/zeitstrahl.ts` (Fenster aus ganzen Monaten `ab`+`monate`,
  `standardAb`/`heuteAb`, `abAus` ±50 Jahre, `monatsTicks` mit Jahreswechsel, `quartale`, `stapeln` mit „+n“-Bündeln,
  `zielJahr`/`meilensteinJahr`/`meilensteinImJahr`, `jahrLage` für den Forecast, `planTag` für ZOE, `zaehltImKurs` für die Indizes)
  — Ansichten rechnen nichts davon selbst. Jahresziele: optional `jahr`, lesen NUR über `zielJahr()`; der Ziele-PATCH (Jahr)
  stempelt es (`jahrStempeln`), die Kaskade nimmt nur das laufende Jahr. Fokus je Jahr nur über `lib/planung/jahr-fokus.ts`
  (laufendes Jahr doppelt, ausgeliefert via `fokusFuerLaufendesJahr`). Meilenstein öffnen/anlegen: `useMeilensteinFenster`
  (`components/os/planung/MeilensteinFenster.tsx`) — kein zweiter Schreibweg, keine Aufgaben-Logik dort; Markierungen öffnen die
  Detailseite (`WEG.meilenstein`). Das Jahr zeigt die Lichtfäden (Fenster `useStrahlFenster`, Blättern `useBlaettern`), `Zeitstrahl` ist der schlichte Strahl.
- **Lichtfäden v2 (03.10., LICHTFAEDEN.md + DESIGN_STANDARD.md › Lichtfäden):** EIN Modell für alle Ebenen — Stränge (`lib/lichtfaeden/modell.ts`:
  Quelle, Pfad gesamt → space → thema → ziel → meilenstein, Person, Zeit, Gewicht aus `QUELLEN`, Status, Link, privat) aus reinen Adaptern
  (`lib/lichtfaeden/quellen/*`: Planung, Kalender, Markttraktion, Finanzen, Beziehung, Gesundheit), Baum/Dichte/Ansicht (`baum.ts`, LOD), Engstellen
  (`fokus.ts`), gesammelt NUR in `sammeln-server.ts` (vorhandene Lesefunktionen, `sicher()`, `merken` 60 s) und ausgeliefert über `GET /api/lichtfaeden`
  (Haushalts-Tor, Dienstweg 403). **Privat-Regel:** private Stränge der anderen Person nur über `fuerBetrachter` als anonymes „Belegt“ (kein Titel/Link/
  Thema/Ziel) — neue Quellen setzen `privat`, nie selbst maskieren. Oberfläche nur `<Lichtfaeden wurzel=… />` (components/os/lichtfaeden): Planung Jahr,
  Ziel, Meilenstein, Fokus. Zeichner `faedenband.ts` auf `band.ts` + `zeichnen.ts` (dieselben Dateien laufen auf website/ UND fokus/:
  `node scripts/lichtfaeden-website.mjs` schreibt beide, Wächter `tests/lichtfaeden.test.ts`). Ziel-Farben rechnet NUR der Server
  (`lib/planung/ziel-farben-server.ts`, Feld `farbe` in `GET /api/state/ziele` und an den Ziel-Knoten); Space ohne Angabe, Wurzel-Ziel und Thema
  je EINE Regel in `lib/lichtfaeden/modell.ts`; Planungsdaten im Browser nur über `lib/planung/ziele-client.ts` (Wächter `tests/ziele-eine-quelle.test.ts`). Nie im Zeichner Daten rechnen. Der schlichte `Zeitstrahl` bleibt für Monat/Quartal/Aufgaben/Bauplan.
- Tests `tests/planung-*.test.ts`. Sichtprüfung nur mit Wegwerfkonto; Ziele/Meilensteine/Routinen sind GETEILTE Bestände —
  Schreibtests nur über `fuer: 'ich'` (persönlicher Ziele-Speicher), nie in `ziele`/`meilensteine`/`routinen` selbst.

## Meilensteine im Detail — Aufgaben, Verlauf, Dateien, Notizen (30.09., nur lokal)
- **Meilenstein ↔ Aufgaben (EINE Quelle, nur per Kennung):** Aufgaben am Meilenstein sind echte Aufgaben im Bestand `tasks`.
  Jeder Meilenstein hat seine Liste `meilensteinListeId(id)` (`lm-…`, rein aus der Kennung abgeleitet) im Projekt
  `meilensteinProjektId(space)` („Meilensteine“, `pm-<space>`) des Space `meilensteinAufgabenSpace(m)` (Privat → privat, Mandat →
  `m-<firmaId>`, Einheit → kdc/kdv/ug, sonst kdv). Eine Aufgabe gehört dazu, solange sie in dieser Liste liegt — KEIN Feld an der
  Aufgabe, keine Kopie. Regeln rein in `lib/planung/meilenstein-aufgaben.ts`, Schreiben in `…-server.ts`
  (`meilensteinStrukturSichern` über `aufgabenAendern` als Systemlauf, idempotent). Die Liste entsteht im Schreibweg des
  Meilensteins (PATCH/PUT `/api/state/meilensteine`, Kaskade in `/api/state/ziele`) und „lazy“ in GET `/api/planung/meilenstein`;
  Titel/Datum/Space ändern → Liste zieht nach (samt Aufgaben bei Space-Wechsel). Gelöschter Meilenstein → Liste `archiviert`
  (Aufgaben bleiben); zurückgeholt (Rückgängig) → wieder aktiv. „Neu anfangen“-Archiv (`archiviertAm`) bleibt unberührt.
  Neue Anleger: `/api/tasks/create` mit `meilensteinId`, ZOE `create_task` mit `meilenstein`.
- **Fortschritt-Regel:** hat ein Meilenstein zählende Aufgaben, gilt `fortschrittAusAufgaben` (Hauptaufgabe = 1, sonst Anteil
  erledigter Unteraufgaben; abgebrochen/Papierkorb/Archiv zählen nicht), sonst der Wert von Hand; erledigt = 100. Der Server
  schreibt ihn in `fortschritt` (nach jedem Aufgaben-Schreiben mit berührter Meilenstein-Liste — Haken in `aufgabenAendern` — und
  in der Sperre des Meilenstein-PATCH). Ziele: `zielId` (bzw. `abgeleitetVon` aus der Kaskade) → Mittelwert der Meilensteine
  (`zieleNachziehen`). Ansichten zeigen dann keinen Schieberegler. Neue Leser nehmen `wirksamerFortschritt`.
- **Austausch** `meilenstein-raum--<haushalt>` (Register „tilgen“, Art. 17 über `person-weitere.ts`): Verlauf in der Form der
  Aufgaben-Kommentare (+ `antwortAuf`, `bearbeitetAm`, `zoe`), Notiz mit Stand (409) + Verlauf ohne Text, Links nur http(s).
  Regeln rein in `lib/planung/meilenstein-raum.ts` (`anwenden`): fremde Nachrichten unveränderlich (403), eigene weich entfernen,
  Erwähnungen rechnet der Server aus dem Text → `melde` (Link `WEG.meilenstein(id, 'verlauf')`), Grenzen → 413. Route
  `/api/planung/meilenstein` (GET/POST): nur Haushalt des Inhabers mit Person, `bauPruefen`, Körper ≤ 128 KB. UI-Bauteil für
  Kommentare UND Verlauf: `components/os/austausch/BeitragsVerlauf.tsx` (nie ein zweites). Dateien: Aufgaben-Ablage mit `listeId`.
- **Oberfläche:** `components/os/planung/MeilensteinDetail.tsx` (Seite `app/os/planung/meilenstein/[id]`), Bearbeiten nur im
  Meilenstein-Fenster (`useMeilensteinFenster`), Link „gehört zu …“ an Aufgaben `MeilensteinVerweis.tsx`. Markierungen der
  Lichtfäden (und des Monats-/Quartals-Strahls) → `WEG.meilenstein(id)`. Offen: ZOE-Knopf „zusammenfassen / nächste Schritte“, Befund „Liste ohne Meilenstein“
  in der Verbindungsprüfung (rein vorbereitet: `listenOhneMeilenstein`). Tests `tests/meilenstein-aufgaben.test.ts`.

## Ziel ↔ Meilenstein — Kette und Abhängigkeiten (01.10., nur lokal)
- **Regeln EINMAL rein** in `lib/planung/meilenstein-kette.ts` (client-/server-sicher): `wartetAuf` am Meilenstein (optional, ≤ `KETTE_MAX` = 10, keine Kreise —
  `kreisBei` aus `lib/aufgaben/abhaengig.ts` wiederverwendet), `kettePruefen` (Schreibweg), `ketteOrdnen` (Stufen, parallele nebeneinander), `verschiebeInKette`/
  `zieheInKette` (Pfeile/Ziehen; eine Abhängigkeit geht vor), `wartet`/`wartetText` (Anzeige-Status, nie gespeichert), `datumVorVorgaenger` (nur Warnung),
  `ohneMeilenstein`/`verweiseZurueck`/`ohneToteVerweise`/`zielVerweiseLoesen` (Verbindungen), `zielFortschrittLive`. Ansichten rechnen davon nichts selbst.
- **Schreibweg:** `/api/state/meilensteine` PATCH prüft über der Liste NACH den Änderungen (`listeNachOps` → `kettePruefen`: Kreis/unbekannt → 409, > 10 → 413) und
  räumt in derselben Sperre tote Verweise (`danach`); `teil` läuft durch dieselbe Säuberung. `/api/state/ziele` PATCH löst bei gelöschten Zielen nur `zielId`
  der Meilensteine (nie mitlöschen) und räumt Verweise auf wegfallende abgeleitete Meilensteine. ZOE `setze_meilenstein` (Stapel): `ziel`, `wartet_auf`.
- **Oberfläche:** Ziel-Detail `/os/planung/ziel/<id>` (`WEG.ziel`, `ZielDetail.tsx`, Probe des Horizonts, dann `usePlanung(horizont)`); Löschen nur über
  `loescheMeilenstein`/`loescheZiel` (mit „Rückgängig“, Kette/Bezug mit). `usePlanung.alleZiele` (alle Horizonte, nur lesen) für Brotkrumen und Namen.
  Meilenstein-Fenster: `MsVorgabe.zielId`/`wartetAuf`, Feld „Wartet auf“. Glocke/Kalender: die Frist sagt „wartet noch auf …“ (`lib/kalender/eintraege.ts`).
- **Rückweg:** af4679a verwirft `wartetAuf`, Ziel-`messlatte` und `zielId` beim nächsten Speichern (GO_LIVE_CHECKLISTE › Rückweg); Wächter-Fixture
  `tests/fixtures/alt-af4679a/meilensteine.ts`/`ziele.ts` (wörtlich alt). Verbindungsprüfung: `meilenstein-ziel-tot`, `meilenstein-wartet-tot`. Tests `tests/ziel-kette-0110.test.ts`.

## Kapazität — Zeit und Machbarkeit je Person (04.10., nur lokal, Branch `kapazitaet`)
Kevin: „Schlichtweg die Zeit und Machbarkeit über die Personen und Kapas … manchmal sind die Ziele nicht zu erreichen, weil
man sonst 30 Stunden am Tag arbeiten müsste … realistisch planbar.“ (UMBAU_ABEND_0410.md › 7)
- **Rechnung EINMAL rein** in `lib/kapazitaet/modell.ts` (`kapazitaetRechnen`): je Person und Tag ab heute (53 Wochen) Soll =
  Grundwert (h/Woche ÷ 5) · sonst Wochenvorlage (Planung › Routinen, Blöcke „business“) · sonst Annahme 40 h (nur Konten;
  Team-Personen ohne Grundwert zählen nicht) − Urlaub/Feiertag/ganz abwesend − Termine im Arbeitsfenster (überlappungsfrei, Art
  „termin“ + Abwesenheit mit Zeit; Fokus/Blöcke sind Arbeit, kein Abzug) − 15 min Umschalten je Termin − feste Blöcke = netto;
  × Kopf & Energie (Team-Faktor aus Erholung grün 1,0 · gelb 0,9 · rot 0,75, nur die nächsten 14 Tage) = belastbar; − Zuweisungen
  (Mandat/Kunde, h/Woche) = frei. **Machbarkeit** je Meilenstein/Ziel der Reihe nach (überfällig, Termin, Rang — „nicht schon
  verplant“): Rest = Aufwand × (1 − Fortschritt) gegen frei bis zum Termin: ≤ 80 % machbar, ≤ 100 % eng, sonst „nicht machbar —
  bräuchte N h/Tag, frei sind F“ (> 24 h: „mehr, als ein Tag Stunden hat“); ohne Aufwand „Aufwand fehlt“, ohne Termin „Termin fehlt“.
  Ziel = schlechtester Status aus eigenem Aufwand + Meilensteinen (`zielMachbarkeit`). Neue Regeln dort, nie in Ansichten.
- **Andock-Stelle für jeden Strahl:** `lib/kapazitaet/last.ts` `lastJeWoche(stand, { von, bis }, person?)` / `engpassWochen` — je Woche
  kapa, bedarf, auslastung, stufe (leer/gut/eng/ueber), `engpass`, Lage im Fenster `anteilVon/anteilBis` (0–1). Gezeichnet von
  `LastBand` (components/os/kapazitaet/teile.tsx) als eigene Komponente UNTER den Lichtfäden im Jahr — die Strahl-Dateien bleiben unberührt.
- **Daten:** Aufwand steht AM Meilenstein/Ziel (optional `aufwand` h + `personen` Team-Kennungen, nur Business; Säuberung
  `aufwandSaeubern` in lib/planung/meilensteine.ts, auch für Ziele; die Kaskade lässt beides stehen). Alles andere im Bestand
  `kapazitaet--<haushalt>` (Haushalt des Inhabers; Register `H`): je Person Grundwert + Ausnahmen (Urlaub, Block), Zuweisungen
  Person × Mandat/Kunde (nur CRM-Kennungen). Personen = Team des Haushalts (`teamStand`, Kennung `konto-<speicher>` bzw. Team-Kennung,
  nie Platzhalter, nichts fest im Code). Ist = bewusste Business-Fokuszeit (`zeit--<person>`), je Meilenstein über die Aufgaben-Liste.
- **Server:** `lib/kapazitaet/server.ts` (vorhandene Lesewege: `verfuegbarkeitFuer`, vitals, Zeit, Meilensteine/Ziele, CRM; `merken` 60 s
  je Haushalt+Tag). Route `GET/PATCH /api/kapazitaet` (nur Haushalt des Inhabers mit Person). **Privatfilter serverseitig**
  (`fuerBetrachter`): Erholungswert und Ausnahme-Titel nur für die Person selbst; Erholung zählt überhaupt nur, wenn die Person ihre
  Gesundheit mit ALLEN anderen Konten des Haushalts teilt, und dann nur im Team-Faktor. Schreiben (`lib/kapazitaet/aendern.ts`
  `kapaAendern`, Ops grundwert/ausnahme/ausnahme-weg/zuweisung/zuweisung-weg): eigene Kapa oder Inhaber, Team-Personen ohne Konto
  nur der Inhaber → sonst 403; unbekannt 404; Unsinn 400; > 50 Ops 413; alles oder nichts.
- **Säule `kp` im Business-Index** (`lib/kapazitaet/kennzahlen.ts`, 15 %, alle übrigen ×0,85, nur Gesamtsicht): Last nächste 4 Wochen,
  machbare Meilensteine, Plan-Treue (Ø Ist 4 Wochen ÷ Ø Plan nächste 4 Wochen), Puffer je Woche, Kopf & Energie (Team). `SaeuleDef.nurMitMessung`
  (lib/kennzahlen/kern.ts): ohne Messung fällt sie auch aus Gesamtgewicht/Abdeckung — der Index ist dann EXAKT der bisherige (Test).
  Summen kommen über `kapaKennzahlenFuerIndex` in `ladeRoh` (Fehler → null, Säule zählt nicht). „Auslastung“ (fakturiert) und
  „Meeting-Last“ bleiben in Personal — hier wirkt die Meeting-Last nur als Umschaltzeit (nicht doppelt gezählt).
- **Oberfläche:** Planung › Kapazität (`WEG.kapazitaet()`, `KapazitaetAnsicht`: vier Zahlen + Last-Band Team, Machbarkeit, je Person
  12 Wochen + Grundwert/Urlaub/Blöcke/Zuweisungen), Meilenstein-Fenster „Aufwand (h)“ + „Wer arbeitet daran“, `MachbarZeile` in
  Meilenstein- und Ziel-Detail (Ziel: „Eigener Aufwand“). Browser nur über `useKapazitaet` (`kapazitaetNeu()` nach dem Speichern).
- Tests `tests/kapazitaet.test.ts` (30-h/Tag-Fall, Reihenfolge, Urlaub/Block/Termine, Kopf & Energie, Andock, Rechte, alte Daten,
  Säule ohne Messung = alter Index), `tests/kapazitaet-route.test.ts` (Testkunde 403, Privatfilter, Rechte).

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
- **Aufgaben-Ebenen (01.10., Kevin: „Unteraufgaben bei dem HOS unter Produkten … Beschreibungen“):** mehrstufige Unteraufgaben bis **5 Ebenen**
  (Hauptaufgabe = 1; die EINE Grenze `AUFGABEN_EBENEN_MAX` in `lib/aufgaben/ebenen.ts`, dort auch alle reinen Helfer: `vorfahren`/`kette`/
  `wurzelVon`/`ebeneVon`/`nachfahren`/`teilbaumHoehe`/`waereKreis`/`elternPruefen`/`elternKandidaten`/`anteilFertig`/`elternOrdnen`/
  `mitVerbliebenenVorfahren`/`elternAusText`). **Keine Formänderung** — `parentId` darf auf eine Unteraufgabe zeigen; jede Ebene ist eine volle
  Aufgabe (Beschreibung, Notiz, Status, Zuständig, Dateien, Zeit …). Regeln: **Schreibweg** (`aufgabenAendern`, auch `/api/tasks/create`) prüft gegen den
  Endstand: Elternteil fehlt/Papierkorb → 400 (create: 404), zu tief → 400, Kreis → 409 `kreis` — jeweils „Abgelehnt … Nichts gespeichert“; die
  Säuberung verwirft `parentId = eigene Kennung`. **Ort** (Space/Projekt/Liste) kommt von der Hauptaufgabe (Übernahme `uebernehmen`, Wurzeln zuerst,
  idempotent in EINEM Lauf); Umhängen/Umziehen zieht den ganzen Teilbaum (Reducer `UPDATE_TASK`, `umhaengenTeil`). Die Übernahme heilt Altbestand ohne
  Verlust: Kreis → kleinste Kennung wird Hauptaufgabe, zu tief → am Vorfahren der vorletzten Ebene. **Rekursiv**: Erledigt-Rückfrage und „Termin
  mitverschieben“ (alle Ebenen), Fortschritt/Meilenstein (`anteilFertig`: erledigt = 1, sonst Mittel der zählenden Kinder), Papierkorb (`geloeschtMit`
  = die gelöschte Aufgabe für alle Nachfahren; `mitVerbliebenenVorfahren` blendet auch Enkel aus), Wiederherstellen (Vorfahre im Papierkorb → Hauptaufgabe),
  Archiv/„Neu anfangen“ (Wurzel + ganzer Teilbaum; Art. 17 und Kennungs-Umzug arbeiten je Aufgabe über `bezug`, unberührt), Serien (Kennungen `<eltern>-u<n>`, ganzer Teilbaum zurückgesetzt), Vorlagen
  (speichern/anlegen/säubern bis zur Grenze), „nur ich“ (jeder Vorfahre zählt, `darfSehen`), Kalender (Vorfahre im Papierkorb/„nur ich“ blendet aus),
  Verbindungsprüfung (`aufgabe-eltern-fehlt`, `aufgabe-ebene-ungueltig`), Brain-Spiegel (Checkliste eingerückt). **Oberfläche:** `BaumAnsicht` (je Ebene
  aufklappen, n/m, „+ Unteraufgabe“ bis zur Grenze, darunter Hinweis „Checkliste in der Notiz“), `AufgabeDetail` (Brotkrumen der ganzen Kette, direkte
  Unteraufgaben mit Anlegen und Beschreibungs-Zeichen ¶, „Umhängen“/„zur Hauptaufgabe machen“ nur mit `elternKandidaten`), `SchnellAnlegen` (Elternteil
  mit Pfad), Tabelle (`tabelleZeilen` rekursiv), Suche (Treffer in der Tiefe holt die Hauptaufgabe; Überblick-Suche zeigt „in Pfad“). **ZOE:** `create_task`
  hat `unter` (Titel, Pfad „Hauptaufgabe › Unteraufgabe“ oder Kennung; nur Aufgaben, die die Person sehen darf; mehrdeutig → Rückfrage mit Pfaden), im
  Stapel-Vorschlag steht „Unteraufgabe von …“; Freigabe-Unteraufgaben werden erst auf Ebene 5 zur Checkliste (`alsChecklisteBei`). **Rückweg** (alter Stand
  kennt zwei Ebenen): flacht beim nächsten Speichern ab, Inhalte bleiben — `GO_LIVE_CHECKLISTE.md` › Rückweg. Tests: `tests/aufgaben-ebenen.test.ts`.
- **Modell** (`types/tasks.ts`, verträglich): `Task.spaceId`, `listeId`, `parentId` (mehrstufig bis `AUFGABEN_EBENEN_MAX` = 5, siehe „Aufgaben-Ebenen“; erbt Space/Projekt/Liste von der Hauptaufgabe), `statusId`, `bezug`
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
  nur die Konflikt-Zeile nimmt den Server-Stand, die eigene bleibt als „Deine Fassung“ (seit 29.09., Datenschicht „Ausstehende Änderungen nie verwerfen“) + Ereignis `make-aufgaben-konflikt`. Seite `/os/aufgaben` = `components/os/aufgaben/AufgabenRaum.tsx` (Adresse seit 28.09. spät über
  `WEG.aufgaben` — siehe „Navigation wie im CRM“ unten; alte `space`/`r`/`offen` gelten weiter), Schnell-Anlegen ganz oben (`SchnellAnlegen`, Kürzel aus `schnell-anlegen.ts`),
  Detail (`AufgabeDetail`), Board nach Status (`StatusBoard`), eigene Status (`StatusVerwalten`). `/os/aufgaben/board` = alter Zeitstrahl/Delegation.
- **CRM:** Kachel „Aufgaben“ in Kontakt öffnen (`KontaktRechts`) und Firmenakte (`AufgabenAkte`, bei aktivem Mandat im Mandanten-Space).
  Art. 17 löst `bezug.kontaktId` und tilgt Namen auch in Kommentaren, Dubletten biegen `bezug.kontaktId` um, Verbindungsprüfung
  `aufgabe-bezug-tot` (Reparatur entfernt nur tote Einzelverweise), Übergabe setzt `bezug`. Fokus-Block auf eine Aufgabe mit Mandat übernimmt es.
- **Flächen:** Aufgaben-Widget ohne Einstellung nimmt den Space der Fläche (`lib/flaeche/space.ts`); Unteraufgaben nur unter „fällig & kritisch“.
- **Ansichten Tabelle + Kalender (C5, 28.09. spät):** `AnsichtTabelle` (Spalten fest + eigene Felder je Projekt als `feld:<projekt>:<feld>`, Kopfklick
  auf → ab → Listen-Reihenfolge, Leeres immer unten, Unteraufgaben unter ihrer Aufgabe; Status/Zuständig/Deadline/Priorität/Felder direkt über `UPDATE_TASK`;
  Summen Zahl/Betrag über alle Aufgaben inkl. Unteraufgaben; Spalten + Sortierung je Person in `make-aufgaben-tabelle:<person>`; Querlauf nur im eigenen
  Behälter) und `AnsichtKalender` (Monat/Woche, Balken Start → Deadline je Woche in Bahnen, Farbe Status/Gruppe, „!“ überfällig, ↻ wiederkehrend; Ziehen
  oder „verschieben auf …“ = `verschiebenTeil`, Start wandert mit; „Ohne Datum“ als Seitenliste; heute = `berlinHeute`). Rechnen nur in
  `lib/aufgaben/ansichten.ts` (Test `tests/aufgaben-ansichten.test.ts`). Umschalter in `AufgabenRaum` (hängt C1 ein), Adresse `ansicht=tabelle|kalender` (`lib/aufgaben/adresse.ts`).
- **Wiederkehrend + Vorlagen (C3, 28.09. spät):** Kalenderrechnung NUR in `lib/aufgaben/wiederholung.ts` (täglich · Werktage · wöchentlich mit
  Tagen · monatlich mit Monatstag, 31 → Monatsende gekappt · jährlich mit festem Tag für 29.02.; Intervall, `bis`; Kalendertage über UTC-Mittag,
  heute = `berlinerTag`; Platzhalter {Monat} {Jahr} {KW} {Datum}). Serien rein in `lib/aufgaben/serie.ts`: **Aufgabe** erledigt → im Schreibweg
  (`aufgabenAendern`) die nächste Instanz (`naechsteInstanz`: Unteraufgaben zurückgesetzt + Deadlines mitverschoben, Notiz/Felder/Zuständig/Bezug/Ort
  übernommen, nie Kommentare/Verlauf/ZOE/Abhängigkeiten/eigener Status), Serie = `serieId` (erste Kennung; alt `vorlageId` „serie:…“ übersetzt die
  Übernahme, `vorlageId` bleibt die Herkunftsvorlage), Kennung `w-<fnv>-<JJJJMMTT>`,
  höchstens eine offene je Serie, nie in der Vergangenheit (springt auf ≥ heute); Verlauf „angelegt“ durch System, Antwort `serien[]` → Browser lädt nach.
  **Liste:** die NEUESTE der Serie trägt `wiederholung.naechste` + `vorlageId` + `titelMuster` (sonst Muster = Vorlagen-Name); Morgenlauf `/api/tagesstart` Schritt
  „Aufgaben-Serien“ (`lib/aufgaben/serie-server.ts`, Haushalt oder Systemlauf, schreibt nur wenn fällig, Protokoll „System“) legt je Serie und Lauf
  höchstens EINE Liste an (`ls-<fnv>-<JJJJMMTT>`, idempotent; monatlich/jährlich älteste verpasste zuerst, täglich/Werktage/wöchentlich nur die
  jüngste) und holt Serien-Aufgaben nach, die ein anderer Schreiber erledigt hat (nächster Termin ≤ morgen, keine offene). **Vorlagen** rein in
  `lib/aufgaben/vorlagen.ts` (`vorlageAusProjekt`/`vorlageAusListe` nur Struktur, ohne `bezug`/Kommentare/Dateien/Feldwerte; `ausVorlageAnlegen`
  Deadline = Start + `versatzTage`, Mandanten-Space → Firma vorbelegt), drei Startvorlagen im Code (`vorlagen-start.ts`, `start-…`, nie im Bestand).
  Oberfläche: `WiederholungWahl` (+ `SerienZeichen` ↻), `SerienListeEinstellen` (+ `ListeSerieKnopf`), `VorlagenDialog` (+ `VorlagenKnopf`);
  eingehängt in `AufgabeDetail` (Feld „Wiederholt“ über `wiederholungSetzen`) und `AufgabenRaum`. Test `tests/aufgaben-serie.test.ts`.
- **Vertiefung (28.09. spät, C1 — AUFGABEN_PLAN.md „Vertiefung“):** Projekt → **Gruppe** (`gruppen[]` {projektId, titel, farbe, sortOrder,
  eingeklappt}; `Liste.gruppeId`, ohne = direkt im Projekt) → Liste → Aufgabe → Unteraufgabe. `Project`: notiz, beschreibung, status
  (aktiv|pausiert|abgeschlossen), start/ende, mitglieder, felder (`EigenesFeld` text|zahl|betrag|datum|auswahl|link|person). `Task`: notiz,
  felder (Werte typgerecht gegen die Projektfelder im Schreibweg — `feldWerteTypisieren`, Betrag in ganzen Cent; Werte gelöschter Felder bleiben
  stehen), **`abhaengigVon` führt** (`dependencies` wird abgeleitet, `lib/aufgaben/abhaengig.ts`; wer sich geändert hat, gewinnt; Kreise → 409
  `kreis`), wiederholung/vorlageId/zoe (Datenfelder für C3/C4), `verlauf` (**nur der Server**: `lib/aufgaben/verlauf.ts`, Kurzwerte Status/Datum/
  Person/Priorität, nie Texte; > 200 → „+N ältere Änderungen“; PATCH-Antwort `zeilen[].verlauf`, der Kontext trägt ihn nach — `VERLAUF_NACHTRAGEN`).
  Bestand `vorlagen[]` (C3; `VorlageAufgabe.notiz`/`felder` werden beim Anlegen übernommen). Neue Texte über der Grenze → 413 (Notiz 50.000 Zeichen), nie kürzen. PUT nur beim leeren Erststart (seit 29.09.; sonst 409 `neuLaden`).
- **Navigation wie im CRM (28.09. spät):** Adressen NUR über `WEG.aufgaben({ s, p, g, l, a, t, b })` / `aufgabenLink` (lib/aufgaben/adresse.ts):
  ohne Angabe Überblick (`Ueberblick.tsx`: Kacheln meine/heute/überfällig/wartet auf Freigabe + Karten je Privat/Firma/Mandant), `b=archiv`,
  `s` Space, `p` Projektseite (`ProjektSeite.tsx`, Reiter `t` aufgaben|notizen|dateien|felder|verlauf), `g`/`l` Fokus, `a` Aufgabe,
  `ansicht=board|tabelle|kalender`; `space=` für die Seitenleiste wird mitgeführt. Alt bleibt gültig: `?offen=` (WEG.aufgabe — springt in den Space der Aufgabe),
  `r=`, `space=privat` (Privat-Space), `space=business` (Überblick Business). Leiste/Brotkrumen/Mandanten-Kopf in `Navigation.tsx` (alles `Wahl`).
- **Bausteine:** Baum `BaumAnsicht.tsx` (Gruppen farbig/einklappbar, Liste „Gruppe ▾“, Unteraufgaben inline, blockiert = „wartet“), Notiz
  `Notiz.tsx` (Regeln `lib/aufgaben/notiz.ts`: Überschriften, fett/kursiv, Listen, `- [ ]` abhakbar, Links nur http(s) und /os/ — React-Elemente,
  nie `dangerouslySetInnerHTML`), `EigeneFelder.tsx`, `VerlaufListe.tsx`, Dateien `ProjektDateien.tsx` (C2). Zeit je Aufgabe:
  `GET /api/aufgaben/zeit?ids=` (Fokus-Blöcke mit `aufgabeId`, Haushalt, `lib/aufgaben/zeit.ts`). Überblick-Zahlen `lib/aufgaben/uebersicht.ts`.
- **Paket T1 (29.09., Kevins Entscheidungen — Datenschicht; Oberfläche Paket T2):**
  - **„Nur ich“** (`Task.sichtbarkeit: 'nur-ich'`, fehlt = Haushalt; `angelegtVon` setzt NUR der Server): EIN Filter in `lib/aufgaben/sicht.ts`
    (`sichtFuer`/`darfSehen`/`aufgabenFuerPerson`, Unteraufgaben erben über die Eltern). **Leser nur über `ladeAufgabenSicht(person)`** — `person` ist
    Pflicht, `null` = Systemlauf (sieht KEINE „nur ich“-Aufgabe). Geteilte Ausgaben (Brain-Spiegel `_App`, Such-Index, Delegation, Risiko, Onboarding)
    nehmen die Systemsicht. `ladeAufgabenUngefiltert` nur für Läufe, die je Aufgabe selbst filtern (ZOE-Lauf im Namen der Auftraggeberin). Schreiben
    (auch löschen, Unteraufgabe darunter) auf eine fremde „nur ich“-Aufgabe → 404; auf „nur ich“ stellen nur die Anlegerin; „nur ich“ nennt keine andere
    Person (Zuständig/Beteiligte/Wechsel → 400). Meldungen nie über Aufgaben, die die Empfängerin nicht sehen darf.
  - **Eine Verantwortliche + Beteiligte** (`assignee` = eine Person des Haushalts, sonst 400; `beteiligte[]`): „both“ löst `lib/aufgaben/zustaendig.ts`
    `beideAufloesen` auf (Anlegerin → Verlauf „angelegt“ → Schreiberin → letzte Schreiberin → sonst erste Person + Hinweis im Log) — in der Übernahme
    (`uebernehmen(roh, orgs, personen)`, Personen = `haushaltsSpeicher()`, Inhaber zuerst) UND beim Schreiben. „Meine“ = verantwortlich, Filter/Kachel
    „beteiligt“ zusätzlich; Meldung an neu Beteiligte. Übernahme-Version 2 (`UMBAU_VERSION`, Archiv `tasks-vor-umbau-v2-<zeit>` einmal).
  - **„Abgebrochen“** (`cancelled`, Grundstatus + `basis` eigener Status): `istAbgeschlossen`/`istOffen` (struktur.ts) — nicht offen, nicht erledigt
    (Fortschritt/Quote ohne), gibt Wartende NICHT frei (`wartetAuf` wartet weiter), keine Folgeinstanz, keine Glocke.
  - **Server-Felder** (`serverFelder` in speicher.ts): `createdAt` nur beim Anlegen, `updatedAt` nur bei echter Änderung, `completedAt` beim Übergang nach
    „erledigt“ (Server-Zeit), `angelegtVon`, `zoe.status` per PATCH nur unverändert (Änderung nur `aufgabenAendern(…, { zoeStatus: true })` = ZOE-Wege).
    Prüfregeln rein in `lib/aufgaben/pruefen.ts` (nur geänderte Werte): Tag gültig (`dueDate`/`startDate`), Start ≤ Deadline, monatlich braucht
    `monatstag`, Personen aus dem Haushalt → 400. Alte Deadlines als Zeitstempel → Berliner Tag (Übernahme, `deadlineAlsTag`).
  - **Server-Schreiber** (Heads, Head of Finance, Steuern, Löschfristen, Belege, CRM-Events, Übergabe, Head-Autonomie) nur über
    `systemAufgabenAendern(stand => ({ neu, teile }), { person?, jetzt })` (`lib/aufgaben/system-schreiben.ts`): Änderungen werden IN der Sperre berechnet,
    Verlauf `durch: 'system'`, Serien, Protokoll, Meldungen; nichts zu tun → nichts geschrieben. Nie wieder `updateJson('tasks', …)` für Status/Anlegen.
    `aufgabenAendern` nimmt dafür auch `(stand) => AufgabenOps`; `teilOp` baut eine Teil-Änderung ohne Stand.
  - **Serien:** `wiederholung.ab: 'erledigt'` (Basis = Tag der Erledigung), `rotation[]` (nächste Instanz → nächste Person), Regel „Werktage“ ohne
    Feiertage NRW (immer), `feiertage: 'NRW'` schiebt andere Regeln auf den nächsten Werktag (`lib/aufgaben/feiertage.ts`, Gauß), `ausnahmen[]`,
    `serieBeendet`. Termin nur über `serienTermin`. Die JÜNGSTE Instanz entscheidet (ohne `wiederholung`/mit `serieBeendet` = beendet); „nur diese
    löschen“ (Papierkorb einer offenen Instanz) → Tag in `ausnahmen` + nächste Instanz sofort (`serieUeberspringen`); wieder geöffnet → die unberührte
    Folgeinstanz geht weg (`folgeinstanzenBeimOeffnen`, Antwort `serien` → Browser lädt nach).
  - **Blockiert (#36):** Kachel „Wartet auf andere“ (`kachelAufgaben(…, 'wartet')`), „überfällig“ ohne Wartende, `SpaceStand.wartet`; Glocke „„X“ wartet
    auf „Y““ statt „überfällig“; Flächen-Widget und ZOE-Auftrag nennen, worauf gewartet wird. Zuweisungen je Absender und Schreibvorgang gebündelt (#42).
  - **Kommentare weich** (`entfernt: { am, von }`, nur eigene; Anzeige „Kommentar entfernt“). Sortierung `nachReihe` = (sortOrder, createdAt, id).
    GET `/api/state/tasks` mit ETag/304 (Stand tasks/crm/ordnung/konten + Person + Papierkorb). Tests `tests/aufgaben-t1-{modell,server}.test.ts`.
- **Paket T2 (29.09., Oberfläche + ZOE-Freigabe + CRM-Einheit + „Neu anfangen“):**
  - **„Neu anfangen …“** (Aufgaben-Überblick + Ziele & Planung Monat/Quartal/Jahr; Kevin: „alle Ziele und Aufgaben rausnehmen und neu planen“):
    `/api/neustart` (GET Vorschau, `?archiv=1` Läufe; POST `neu-anfangen` mit `laufId: na-…` + `bestaetigung: 'NEU ANFANGEN'`, POST `zurueck` ganz/
    Projekt/Aufgabe/Ziel/Meilenstein) — nur Personen im Haushalt mit eigener Sitzung. Server `lib/aufgaben/neustart-server.ts`: Sicherheitskopie über
    `archivSchreiben` → Lauf-Protokoll `planung-neustart--<haushalt>` → je Bestand EINE Sperre (Bestand außen, Protokoll innen). **Aufgaben/Projekte/
    Gruppen/Listen** bekommen `archiviertAm` + `archivId` (bleiben im Bestand — Dateien, Zeiten, Follow-ups zeigen auf Vorhandenes); `aufgabenSicht`
    blendet sie aus (`ohneArchiv`, lib/aufgaben/neustart.ts). Serien ruhen (`wiederholung` im Lauf gemerkt, zurück = läuft weiter). Bleiben: Papierkorb,
    Vorlagen, eigene Status, offene Fristen-Aufgaben der Module (`steuer-`, `beleg-`, `loeschfrist-kontakte`, `ev-`). **Ziele** (geteilt + `ziele-eigen`
    je Person) samt Fokus-Sätzen und **Meilensteine** wandern ins Lauf-Protokoll (lib/planung/neustart.ts) — zurück nie über vorhandene Kennungen,
    Fokus nur in leere Plätze. Routinen/Blöcke/CRM unberührt; Meldungen zu archivierten Aufgaben gelesen. Ansicht: Aufgaben › Archiv › „Neu angefangen“.
    Wer `tasks` roh liest (Brain, Art. 15/17, Verbindungsprüfung), sieht Archiviertes mit Marke — bei neuen Lesern `imArchiv` beachten.
  - **Oberfläche:** 🔒 „nur ich“ (Detail + Schnell-Anlegen; macht die Anlegerin zuständig, ohne Beteiligte), Zuständig = eine Person + „Beteiligte“
    (`WahlMehrfach`), Filter Alle · Meine · Beteiligt, „Abgebrochen“ grau/durchgestrichen (Board-Spalte bei Bedarf), Serien-Extras in `WiederholungWahl`
    (`extras`), „Diese überspringen“ (`serieUeberspringen` im Browser) getrennt von „Serie beenden“; Löschen einer laufenden Instanz fragt. Kennzeichen
    an EINER Stelle `components/os/aufgaben/Zeichen.tsx` (🔒, Titelstil, „!!/!“, „! 02.10.“ überfällig). **Rückfragen + „Rückgängig“ (10 s)** nur über
    `HandlungProvider`/`useHandlung(dispatch, statusEigen)` (Handlung.tsx; ohne Provider direkte Aktionen): erledigen (offene Unteraufgaben → mit erledigen/
    offen lassen), Status, löschen, verschieben (Unteraufgaben mitverschieben), umziehen (Privat + CRM-Bezug → lösen/behalten). Datumsfelder nur
    `DatumFeld` (speichert beim Verlassen). Schnell-Anlegen: `parseSchnell(text, projekte, heute)` + `schnellVorschau` (Wochentag nur am Ende/mit Präfix,
    Datum mit Kalenderprüfung). Suche überall `suchPasst` (Titel + Beschreibung). Zeilen-Knöpfe tragen `id="oeffnen-<id>"` (Fokus zurück).
  - **ZOE-Freigabe:** Vorschlag trägt `eingabe._stand` (Status/Deadline beim Vorschlag) und `_charge` (je Lauf); Freigabe → 409 mit `diff` statt
    Überschreiben (`standAbweichung`), „trotzdem“ nur ausdrücklich; Häkchen je Feld (`FreigabeFelder`, `nurGewaehlt`); Deadline nur echter Tag ≥ heute;
    Sammelfreigabe nur `risikoarm` (nur Notiz/Unteraufgaben), mit Charge `_sammel`; „Charge rückgängig“ `lib/zoe/aufgaben-charge.ts` (nur was noch den
    freigegebenen Wert trägt). „_“-Schlüssel nie vom Browser.
  - **Follow-up = Aufgabe:** CRM „Aufgabe anlegen“ legt eine Aufgabe mit `bezug` an; Abgleich beidseitig idempotent (`lib/crm/followup-aufgabe.ts`,
    eingehängt nach jedem Schreiben in speicher.ts bzw. in `/api/crm/followup` erledigen); Follow-up › Fällig zeigt Aufgaben mit CRM-Bezug mit an.
    Nach jedem Schreiben ziehen Dateien umgezogener Aufgaben ihren Bereich mit (`lib/aufgaben/umzug-dateien.ts`).
  - **Export:** `GET /api/aufgaben/export` (Sichtfilter der Person, Papierkorb/Archiv mit Marke, Dateiliste ohne Inhalte), rein `lib/aufgaben/export.ts`
    (`exportBauen`/`exportEinlesen`). Vorlagen: `gruppeIndex`, `versatzArt: 'werktage'` (NRW), `version` → `vorlageVersion`.
    Tests `tests/{neustart,zoe-freigabe-t2,followup-aufgabe,aufgaben-export,aufgaben-vorlagen-t2,aufgaben-umzug-t2}.test.ts`.

## Markttraktion — Deal- und Follow-up-Ebene (27.09., nur lokal)
- **Marke Make.One (27.09.):** unter den Events läuft unsere Veranstaltungsmarke. `lib/crm/marke.ts` ist die eine Stelle (`MARKE_EVENTS`,
  `markeVon` = gesetzt oder Make.One, `eventName` = „Make.One · Titel“); `Event.marke` optional, Vorgabe beim Anlegen, alte Events gelten
  abgeleitet — nie zurückschreiben. Wo ein Event nach außen genannt wird (ICS, Nachfass-/Follow-up-Text), `markeVon`/`eventName` nehmen, nie den Text streuen.
- **Reiter** (`lib/crm/adresse.ts` `BEREICHE`): ueberblick · kontakte · firmen (a=leads) · deals (a=board|liste|akte|kunden|auswertung) ·
  followup (a=faellig|woche|powerhour|kadenz) · marketing · besuche (Events, 03.10.) · event (Make.One) · stammdaten. `aufloesen()` übersetzt den alten Sales-Reiter — alte
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

## Netzwerken — Erfassen auf Veranstaltungen (02.10., nur lokal, Paket A)
- **Seite** `/os/netzwerken` (`WEG.netzwerken({ bericht? })`, `components/os/netzwerken/`): handyzuerst (Ziele ≥ 48 px, Eingaben 16 px gegen iOS-Zoom), „Heute bei“ (Event-Modus, `EventModus`), Reiter Erfassen (`Erfassen`: Karte → Schritt → Bestätigen) und Heute (`Heute`: Abendbericht + Danke-Mails), Knopf „Meine Karte (QR)“ → `/os/netzwerken/karte` (baut Paket B). Warteschlangen-Streifen über allem.
- **Eine Stelle je Aufgabe:** rein `lib/crm/netzwerken.ts` (Schritte, `erfassungPruefen`, `kenntWirSchon`, `firmaVorschlaege`, Danke-Entwurf, `berichtAus`), Server `lib/crm/netzwerken-server.ts` (`erfassungAusfuehren`, `dankeRausVermerken`, `freieVorschlaege`), Route `app/api/netzwerken` (GET Personen/`?frei=`, POST `erfassen`/`danke-raus`), Warteschlange `lib/netzwerken/warteschlange.ts`, Karte-Auslesen (aus) `lib/crm/netzwerken-karte.ts`. Nie neben diesen Stellen eine zweite Dublettenprüfung, Erfassungslogik oder Offline-Warteschlange bauen.
- **Idempotenz ist Pflicht:** die Kennung der Erfassung (UUID, im Browser) ist Schlüssel für alles (`c-<UUID>` Kontakt, `t-…` Teilnahme, `fu-…` Follow-up, `nw-…` Aufgabe, `ch-nw-…` Deal „Vermittlung“ (`dealAnlegen` mit fester `id`), `t-nwm-…` Make.One-Vormerkung, `ang-nw-…` Angebots-Entwurf, `makeos-t-nw-…` Termin-UID); jeder Schritt prüft „schon da?“ und wird im Journal `netzwerken-erfassungen--<haushalt>` abgehakt. Neue Schritte nur so einhängen (Test: Abbruch vor/nach jedem Schritt).
- **Recht:** Visitenkarte = KEINE Einwilligung → nie ein Eintrag in `einwilligungen` (würde die Ampel grün schalten), Vermerk im Verlauf; Danke-Mail nur als Entwurf, nur `mailto:` per Einzelklick, nie Werbung; Art. 18 → 409 bzw. nie in Berichten/Danke-Listen; Dienstweg darf nie erfassen (403, auch mit Person); `zuständig` nur aus dem Haushalt.
- **Teilnahme.netzwerken** (`NetzwerkenAngabe`, gesäubert in `speicher.ts` `zusatz` — ohne diese Zeile fiele sie bei jedem Speichern weg) trägt Schritt, Zuständigkeit, Info, Termin und den Danke-Stand; Abendbericht und Danke-Mails lesen NUR sie. `Anstehend.danke` → Glocke („n Danke-Mails bereit“, Art `danke`, abgeleitet) und Heute; die gespeicherte Meldungsart `netzwerken` (Bezug `netzwerken` = Erfassungs-Kennung) zeigt `NetzwerkenPopup` einmal (`useGlockenSicht`, kein zweiter Abruf).
- **Dateien:** Fotos und Sprachnotizen über `ablegen` (verschlüsselt, `kontaktId`); Sprachnotiz-Typen nur serverseitig aus dem Inhalt (`SPRACHNOTIZ_TYPEN`, nicht im Upload der Oberfläche).
- Sichtprüfung am Handy (375 px): Produktionsbau (`MAKE_OS_DIST=.next-… next build` + `next start`) mit Test-Datenordner und gemocktem iCloud, bedient über headless Chrome (CDP); der Dev-Modus kompiliert unter Last jede Route minutenlang.
- **Korrekturen 03.10. (Branch `netz-fix`):**
  - *Warteschlange:* EINE je Browser (`geteilteWarteschlange`), gesendet vom `NetzwerkenSender` im /os-Rahmen (nicht mehr von der Seite); Seite und Leiste lesen nur (`beiAenderung`, `zaehler.ts`). 5xx → drei Versuche → „Fehler“, nie den Durchlauf abbrechen (nur Status 0/401/429); `teilweise` → „Ohne Termin abschließen“ (`ohneTermin`); `erfasstVon` ↔ Sitzung (409 `andere`). Neue Auslöser dürfen nicht doppelt zählen (`versucht` je `senden()`).
  - *Termin:* `terminAm`/`terminId` an der Teilnahme erst nach dem Kalender-Schritt; `ohneTermin` macht aus dem Schritt ein Follow-up (+1 Werktag). Nie einen Termin nennen, den es nicht gibt.
  - *Dubletten:* EINE Regel `zusammenfuehrung` (`lib/crm/netzwerken.ts`) für Firma-Schritt UND Kontakt-Schritt (sonst verwaiste Firmen); Telefon nur mit Nachname; `luekenFuellen` überschreibt nie. Labels: `Netzwerken`, `Dublette prüfen`, `Lead prüfen`.
  - *Leads:* `leadStellen` im Schritt `schritt` (vor dem Deal): neu → Kontaktiert, Qualifizieren → Qualifizierung, nie über Kein Fit/Ruht/SQL/Kunde, nie Firmen ohne Vertrieb.
  - *Kennzahlen:* Events mit `marke: Netzwerken` (`istNetzwerkenEvent`, `lib/crm/marke.ts`) bleiben aus allen Event-Kennzahlen/Scoreboard/Index; `netzwerkenZahlen` weist sie getrennt aus. Neue Event-Kennzahlen filtern dort ebenso.
  - *Links:* Server liefert feste Kennungen, `ergebnisLinks` baut daraus die Sprünge (Fertig-Seite, Abendbericht) — kein zweiter Linkbauer.
  - *Abmelden:* `vorAbmelden` (KontoView) — Karten-Cache und Warteschlange werden nur bei leerer Warteschlange gelöscht.
  - Karten-Route (`/api/netzwerken/karten`): Dienstweg 403.
- **Nachbesserung Prüfung 03.10. (Branch `netz-fix2`):** (1) **IndexedDB-Ausfall:** `ausfallsicher()` (`lib/netzwerken/warteschlange.ts`) legt bei gescheitertem Öffnen/Schreiben in den Arbeitsspeicher und sendet trotzdem; `Warteschlange.nurImArbeitsspeicher()` → Hinweis `NUR_RAM_HINWEIS` („Bitte Seite offen lassen, bis gesendet“) in Erfassen/Streifen; `indexedDB.open` hat 5 s Zeitgrenze (Safari). (2) **Netzwerken-Events** (`istNetzwerkenEvent`) sind aus Heads (`takt.ts`, `daten.ts`), ZOE `events_lage`, Make.One-Einladung (Server + `SchnellLeiste`/Erfassen-Auswahl) gefiltert. (3) **Art. 18 bei Dublette:** `trifftEingeschraenkte` (vor Firma/Kontakt und noch einmal im Schreibschritt) → 409 `eingeschraenkt`, nichts wird angelegt oder angehängt. (4) **Magic Bytes** in `erfassungPruefen` (`bildInhaltsTyp`/`sprachnotizTypErkennen`) vor dem ersten Schreiben → 415; Typ zählt aus dem Inhalt. (5) **SVG-Säuberer:** Entities zuerst auflösen (`entitiesAufloesen`), dann prüfen, dann neu maskieren; Ausgabe idempotent, Tags passend geschlossen, nach der Wurzel nichts mehr (`tests/netzwerken-svg-fuzz.test.ts`). (6) **Karten-Route** PATCH: 413 über `OPS_MAX × LOGO_MAX + 400 KB` (Header und gemessener Text). (7) **Kontakt-Kennung:** `istKontaktKennung` (`lib/kennung.ts`: neu `c-<uuid>` ODER alt) statt eigener Regex. (8) Kontakt ohne `aktivitaeten` → `?? []`. (9) MAKE-Blatt der Finanzplanung: Sachkosten der Selbstständigkeit ausgefiltert (`sachkostenDerMake`, `einmaligeKostenMake`). (10) Register-Kommentar zur Browser-Warteschlange (IndexedDB unverschlüsselt bis zum Senden).

## Events (besuchte Veranstaltungen) neben Make.One (03.10., nur lokal, Branch `events`)
- **Aufteilung:** Reiter **Events** (`Bereich` `besuche`, `components/os/crm/besuche/`) = Veranstaltungen, die wir BESUCHEN; Reiter **Make.One** (`event`, `components/os/crm/Events.tsx`) = unsere EIGENEN Abende. `events` bleibt der alte Name von
  Make.One (`aufloesen('events')` → `event`, Test) — den neuen Reiter nie `events` nennen. Ein Bestand: besuchte Events = Events mit `marke: Netzwerken` (`istBesuch`/`istNetzwerkenEvent`); Make.One filtert sie überall heraus (Liste, Nachfassen, Wirkung,
  Widget „Nächstes Event“, Heads, ZOE `events_lage`, Kennzahlen inkl. „Nachgefasst binnen 48 h“). Ein Link `?s=event&k=<besuchtes Event>` leitet in die Event-Akte um (`Markttraktion.tsx`) — Verweise von überall nur über `WEG.besuch(id)` (besuchte) bzw. `WEG.event(id)` (Make.One).
- **Eine Stelle je Aufgabe:** Form/Säuberung/Anmeldestand `lib/crm/besuche-form.ts` (kaum Abhängigkeiten, vom Säuberer geladen), Rechnungen `lib/crm/besuche.ts` (`besuchWirkung`, `besuchUrteil`, `besuchUebersicht`, `besuchJeKunde`, `besuchKennzahlen`,
  `heuteBeiAngebot`, `kundenExport`), Oberfläche `components/os/crm/besuche/*`, Server-Weg „An Kunden übergeben“ in `app/api/crm/events/route.ts`. Nie daneben eine zweite Wirkungs-/Export-Rechnung bauen.
- **Neue optionale Event-Felder** (alle in `zusatz('events')`, ohne diese Zeilen fielen sie bei jedem Speichern weg; Wächtertest `crm-saeuberer-waechter`): `fuer` (`{ art:'make' }` fehlt = MAKE; `{ art:'kunde', firmaId, mandatId? }`), `anmeldung`
  (geplant · angemeldet · abgesagt · besucht — fehlt er, abgeleitet aus `status`; setzen nur über `anmeldungPatch`, der `status` mitzieht), `wer` (Team-Kürzel), `link` (nur https), `zielpersonen` (Person ODER Firma, `getroffen`), `uebergaben`
  (Protokoll: Tag, Person, Anzahl). Kosten bleiben `kostenEuro` (Euro; `budgetSumme`), das Ziel bleibt `ziel` (der Standardtext `EVENT_ZIEL` gilt als „kein Ziel“). Grenzen `ZIELPERSONEN_MAX`/`UEBERGABEN_MAX`/`WER_MAX` → 413, nie kürzen.
- **Recht:** Zielpersonen: Art.-18-Personen kommen nie NEU auf die Liste (`personenSchranke`, Liste `events`), Art. 17/Zusammenführen/Art. 15 in `person-verweise.ts`; Firma mit Event (für wen/Zielfirma) → Löschsperre (`loeschSperren`). **Kontakte für Kunden gehören auch uns — MAKE
  ist eigener Verantwortlicher, die Übergabe ist eine Übermittlung (Art. 13/15/19), KEIN Auftrag** (seit 03.10. „netz-recht“, Abschnitt unten; `UEBERGABE_HINWEIS` statt des früheren AVV-Hinweises). `kundenExport`: nur Felder, nie Fotos/Sprachnotizen/Notizen/Kennungen, nie `ausgenommen` (Art. 18 + Werbesperre),
  Formel-Anfänge neutralisiert, Semikolon + BOM; Route nur mit Sitzung (Dienstweg 403), `kontakteFuerVerarbeitung({ mitEingeschraenkten: true })`, jede Übergabe im Protokoll.
- **Netzwerken:** „Heute bei“ = `heuteBeiAngebot` (Heute · nahe Tage · Rest über Suche); `eventNeu.fuer` geht mit, wenn das Event ohne Netz entstand; `EventWahl.fuer`; `?event=<id>` wählt vor (`WEG.netzwerken({ event })`); Erfassen bei einem „angemeldeten“ Event setzt es auf besucht.
- **Kalender:** kein neuer Weg — der vorhandene Spiegel (`events/Kalender.tsx` → `/api/kalender/spiegel`, `eventSoll`) gilt für jedes Event; die Akte zeigt denselben Knopf. Folgeschritt (nicht gebaut): Hinweis in der Glocke „Event ohne Termin“.
- Tests: `besuche-adresse`, `besuche-form`, `besuche-wirkung`, `besuche-route`. Doku: `UPDATES.md` › Events, `GO_LIVE_CHECKLISTE.md` › Rückweg.

## Fokus Innovation — Reihe unter Make.One + Event-Seite (03.10., nur lokal, Branch `fokus-innovation`)
- **Reihe** = drittes Merkmal eines eigenen Abends neben `marke` (Make.One) und `format` (Art des Abends): `Event.reihe` (optional, Kennung aus `EVENT_REIHEN`,
  lib/crm/marke.ts; `reiheVon`/`reiheName`/`titelMitReihe`, nie bei besuchten Events). Neue Reihe = neue Zeile in `EVENT_REIHEN` (Kennung nie ändern). Name nach außen nur über
  `eventName`/`titelMitReihe` (Herkunft, Nachfass-Text, ZOE, ICS) — den Kalender-Spiegel (`eventSoll`, Titel) nicht umstellen, sonst ziehen alle Termine nach.
- **Kennzahlen je Reihe nur in `lib/crm/reihen.ts`** (`reihenUebersicht`, `reihenFilter`, `zahlenSumme` über `eventZahlen`); Leads nach `alsMarketingAnmeldung` (marke.ts) — dieselbe
  Regel nutzt `marketingHerkunft` (scoring.ts). Nie eine zweite Event-Summe bauen. Oberfläche: `ReiheWahl`/`ReiheAbzeichen` (events/gemeinsam.tsx), Kachel `reihen` (flaechen.ts).
- **Event-Seite `fokus/`** (fokusinnovation.de, statisch, nicht online): Regeln wie `website/` (keine Inline-Skripte/-Stile, keine Tracker/Formulare, noindex). Gemeinsames NIE von Hand
  kopieren: `node scripts/fokus-seite.mjs` (Schriften, MAKE-Logo, Lichtfäden-Zeichner über `scripts/lichtfaeden-website.mjs`, Karte inline zwischen KARTE_ANFANG/ENDE, Standbild,
  Favicon), Prüfung `node fokus/pruefen.mjs` (nutzt die Regeln aus `website/pruefen.mjs`, vergleicht Impressum-Block und geteilte Tokens). Keine erfundenen Termine/Zahlen/Preise
  („Termin in Planung“). Online-Gang (Caddy-Vorschlag, IONOS-DNS, compose-Mount) in `fokus/LIESMICH.md` — nur auf Kevins Wort. Tests `fokus-innovation-reihe`, `fokus-seite`.

## Netzwerken ↔ Events ↔ Make.One — die Verbindungen (03.10., nur lokal, Branch `netz-verbind`)
- **Event beim Erfassen:** der Körper trägt IMMER `eventNeu` (nie nur bei `wahl.lokal`); der Server (`netzwerken-server.ts`, Schritt „event“ + Nachprüfung danach) legt ein fehlendes Event daraus neu an, verwendet ein gleichnamiges besuchtes Event desselben Tages wieder
  (`gleichesBesuchEvent`, `eventTitelSchluessel`; die echte Kennung kommt in der Antwort und im Journal `eventId` zurück — IMMER mit `eventId` (lokale Variable) weiterarbeiten, nie `e.eventId` nach dem Schritt) und lehnt abgesagte Events ab (409). Fehler mit Event-Bezug tragen `eventFehler: true` → Warteschlange „Anderes Event wählen“.
  `lokal` wird live aus dem Event-Bestand abgeleitet (`lokalAbleiten`); „für wen“ wartender Erfassungen: `Warteschlange.fuerUmschreiben`.
- **Make.One-Vormerkung nur über `gastVormerken`/`gastTeilnahme`** (`lib/crm/eventplanung.ts`) — Server, Schnellleiste, Gästeliste; setzt `einladenDurch`, `herkunft` (`netzwerkenHerkunft`), Stempel „nachgefasst“ (`begegnungenNachgefasst`). Werbesperre → nichts anlegen. `Teilnahme.herkunft`, `NetzwerkenAngabe.makeone`/`vorher`, `Event.bisDatum` sind im Säuberer (Wächtertest).
- **Personen-Schranke gilt für jeden Schreibweg:** `crmSchreiben` prüft Funktions-Änderungen über `funktionsOps` (neue Teilnahmen, Kampagnen-Personen, Zielpersonen) → `PersonenSchrankeFehler` (409; die Netzwerken-Route übersetzt ihn). Teilnahme-Einladung = Werbung nur bei Status vorgemerkt/eingeladen/zugesagt.
- **Eine Rechnung je Ding:** Make.One-Kennzahlen kennen besuchte Events nicht (keine Kennzahl `netzwerken` mehr, `besuchKennzahlen` allein); Wirkung/Urteil/Ziele nur in `besuche.ts` (`besuchWirkung`, `zielGetroffen`, `besucht`, `eventsOhneTermin`, `begegnungenFuerFirma`); neue Event-Leser: besuchte Events getrennt behandeln
  (`istNetzwerkenEvent`) und Links über `eventLink(event)` (`lib/wege.ts`) — nie `WEG.event` für ein Event unbekannter Art.
- **Nachfassen:** „Nur Kontakt“ → `nachfassenVerzichtet`, „Andere“/„Qualifizieren“/Angebot/Vermitteln/Make.One → `followUpAm`; offene echte Follow-ups (bezug event) ersetzen das virtuelle Nachfassen überall (`team.ts`, `heute.ts`, `followup.ts`, `traktion.ts`).
- **Zusammenführen/Löschen:** `personenUmbiegen` zieht `kalender-bezug` und das Netzwerken-Journal mit (im Schritt „crm“); Event löschen (`/api/crm/events` `loeschen`) räumt Spiegel-Termin (nie Dienstweg), Planposten und Deal-`quelleBezug`. Zielpersonen nur einzeln (`aktion: 'ziel'`, `zielAendern`), nie die Liste ersetzen; „Für wen“ prüft Firma und Mandat (`regelnAbgelehnt`).
- **Datum/Link:** Kalendertage nur über `istKalendertag` (`lib/zeit.ts`, Roundtrip); Event-Links über `linkNormal` (ohne Schema `https://`, http erlaubt, sonst `LINK_FEHLER` sichtbar, nie still verworfen).
- **SVG-Säuberer** (`lib/netzwerken/svg.ts`) ist linear: keine Regex mit `[\s\S]*?` über Nutzereingaben, `CSS_MAX`, Fuzz-Laufzeit-Tests (`tests/netzwerken-svg-fuzz.test.ts`). Tests: `tests/netzwerken-verbind.test.ts`. Doku: `UPDATES.md` › Netzwerken ↔ Events ↔ Make.One, `GO_LIVE_CHECKLISTE.md` › Rückweg.

## Netzwerken — Recht: Interessenabwägung, Übermittlung an Kunden, Fristen (03.10., nur lokal, Branch `netz-recht`; Doku `DATENSCHUTZ_NETZWERKEN.md`)
Kevin: Kontakte, die wir für einen Kunden erfassen, „gehören immer auch uns“ — eigener Verantwortlicher (Art. 6 Abs. 1 lit. f), keine Sperre für die eigene Akquise; die Weitergabe an den Kunden ist eine Übermittlung an einen Dritten. Hinweis, keine Rechtsberatung.
- **Eine Stelle:** `lib/crm/netzwerken-recht.ts` (rein: LIA-Verweis, Art.-13-Hinweisblock `datenschutzHinweisText`, UWG-Wörter `werbeWoerter`, `kennengelerntZeilen`, `uebergabenVon`, `informationOffen`, Hinweistexte `UEBERGABE_HINWEIS`/`ROLLE_HINWEIS`);
  Kontakt-Kontaktweg der Instanz über `NEXT_PUBLIC_MAKE_DATENSCHUTZ_MAIL`/`…_SEITE` (Standard MAKE). Nie daneben eine zweite Hinweis-/Fristenlogik.
- **Neue optionale Felder** (alle nur optional — Kompatibilitätsmodus): am Kontakt `rechtsgrundlageNotiz` („LIA-Netzwerken v1“), `kennengelerntFuer[]` (Firma, Event, Tag), `datenschutzInformiertAm` — **nur der Server setzt sie** (`datenschutzStempeln` nimmt vom Browser nichts an, `teil` leert sie nie,
  Zusammenführen vereint, `PIPELINE_FELDER`); an `Teilnahme.netzwerken`: `neuAngelegt`, `kartenfoto`, `keinGespraech`, `danke.verzichtetAm`; am `Event.uebergaben[]`: `empfaengerFirmaId`, `dateiname`, `kontaktIds`, `avvBzwHinweisBestaetigt`. Neues Feld → auch in den Säuberer (Wächter `crm-saeuberer-waechter`).
- **Kunden-Export = Übermittlung:** erst `kunden-vorschau` (`kundenVorschau`), dann `kunden-uebergabe` mit `hinweisBestaetigt: true` (der Haken „Rolle und Vertrag geklärt“) und `bestandIds` (ausdrückliche Haken). Ungefragt nur Personen mit `neuAngelegt` an diesem Event und Status „da“;
  Bestandspersonen (angehängt, „Diesen nehmen“, Mail-Zusammenführung, Altbestand ohne das Feld) nur mit Haken; gesperrte nie. Herkunft je Zeile aus den Daten (`exportHerkunft`), Telefon streng (`/^\+[\d ]{6,20}$/`, sonst Apostroph), „Kennengelernt am“ = Berliner Tag.
  Das Protokoll **schreibt nur der Server** (`wendeCrmAn` übernimmt `uebergaben` immer aus dem Altstand); Event mit Übergaben löschen = ausdrückliche Bestätigung (`uebergabenBestaetigt`, sonst 409; der generische Löschweg lehnt ab), das Protokoll geht vorher ins **Übergabe-Journal**
  (`uebergabe-journal--<haushalt>`, `lib/crm/uebergabe-journal.ts`, 36 Monate, Register „tilgen“). Auch bei vollem Protokoll (100) wandern die ältesten ins Journal — nie still gekürzt.
- **Art. 15/17/19:** `personAufzaehlen` liefert `uebergaben` („übergeben am … an <Kunde>“, Event + Journal); der Art.-17-Bericht trägt `uebergaben` („Person wurde am … an <Kunde> übergeben — dort informieren (Art. 19)“, im Absichts-Schritt `crm` festgehalten); die Kennung fällt aus `kontaktIds`
  (`person-verweise.ts`: `uebergabenOhne`/`uebergabenUm`), Datum/Anzahl/Empfänger bleiben als Nachweis.
- **Art. 13:** `dankeEntwurf` hängt den Hinweisblock an (bei Kunden-Events mit Empfänger); `dankeRausVermerken` setzt `datenschutzInformiertAm` — zwei Schreibvorgänge (CRM, dann Kartei), der zweite idempotent und bei jedem Aufruf (auch `schonDa`), ein Retry holt ihn nach. Ohne Mail/Gespräch:
  Bericht „… Datenschutzhinweis beim ersten Kontakt geben“, Follow-up-Text „(Datenschutzhinweis geben)“, in der Akte „Heute persönlich erteilt“ (`POST /api/crm/datenschutz { aktion: 'datenschutz-informiert' }`). Selbstprüfung `info-veranstaltung` (Art. 13) und `verzeichnis` (VVT).
- **UWG:** Haken „Wir haben persönlich gesprochen“ (Standard an; `Erfassung.gesprochen` → `Teilnahme.netzwerken.keinGespraech`): nur dann ein Danke-Entwurf; fester Hinweis `DANKE_UWG_HINWEIS`, Rückfrage vor „In Mail öffnen“ bei Werbewörtern; nach **14 Tagen** (`DANKE_FRIST_TAGE`) nicht mehr in Glocke/Heute
  (`dankeOffen`, `abgelaufen`); „Nicht senden“ = `danke-verzicht` (zählt nicht als nachgefasst, „ist raus“ hebt ihn auf).
- **VVT:** `verarbeitungenNachtragen` (nach `id`: `vv-netzwerken`, `vv-besuche-kunde`, `vv-kunden-export`) — idempotent beim Aufruf von `/api/crm/stammdaten`, nie vorhandene überschreiben. **Löschfristen** (`FristArt` `netzwerken-karten` 6 Monate, `netzwerken-sprachnotizen` 90 Tage, `netzwerken-info` 12 Monate nach dem Event, `netzwerken-kontakte` 12 Monate = nur Prüf-Aufgabe
  in derselben Aufgabe wie die 24-Monats-Kontakte, `uebergabe-protokolle` 36 Monate): `lib/crm/netzwerken-loeschen.ts` + Lauf `loeschfristen-lauf.ts` (Schritte 15). Personen nie automatisch gelöscht.
- **Kampagnen-Ampel hart:** `personenSchranke` lehnt bei werblichem Kanal (`WERBLICHE_KANAELE`: mail, linkedin, newsletter) NEUE Personen mit Ampel rot ab (409, ohne Namen), gelb → `kampagnenHinweise` (`hinweise` in der Antwort von `/api/crm/bestand`); `planen` nimmt rote nicht auf. Nur bei vollem Kontakt (Teil-Objekte zählen nicht).
- **Browser:** Offline-Warteschlange nur **verschlüsselt** in IndexedDB (`verschluesselterSpeicher`, AES-GCM, nicht exportierbarer Schlüssel im Speicher `schluessel`, DB-Version 2; ohne WebCrypto → Arbeitsspeicher), ab 14 Tagen `altHinweis`, nach 30 Tagen `altVerwerfen` (Sender/Seite, mit Anzeige `verworfenAlt`),
  Abmelden löscht nach Bestätigung auch Wartendes der eigenen Person samt Datenbank/Schlüssel. Fotos: `lib/netzwerken/bild-bereinigen.ts` entfernt Exif/GPS (Browser-Rückfall + Server in `erfassungPruefen`); kaputter Aufbau → 415.
- **Aus/Vorbereitet:** `TRANSKRIPTION_AN` (Server, Standard aus, nichts wird gesendet; Transkript ersetzt Audio) · Telegram (`telegramText`: `netzwerken`/`danke` nur „… Details in MAKE OS“, der Haken selbst bleibt aus).
- Tests: `netzwerken-recht` (rein), `netzwerken-recht-server`, angepasst `besuche-route`, `besuche-wirkung`, `netzwerken-abmelden`. Website-Entwurf `website/datenschutz.html#kontakte` (Platzhalter, nicht veröffentlicht).

- **Praxis-Funde (03.10., Branch `praxis-fix`; Doku `UPDATES.md`):** `Fenster`-Grid `minmax(0,1fr)` (Inhalte machen den Dialog nie breiter als das Fenster); `Zeile`/`Chip` mit Prop `umbrechen` für Dialoge — nie global umstellen. **Danke-Entwurf/CSV nach Fall** (`dankeEntwurf`: `neu`, `gesprochen`, `eventDatum`+`heute`; `weitergabeAnkuendigen`; `exportHerkunft`/`exportWerbeEinwilligung`) — nie wieder pauschale Sätze („Visitenkarte notiert“ nur bei neu angelegten Personen). **Firma zur Karte:** nur `firmaZurKarte` (Server und Oberfläche). **Gelöschte Events:** `crmSchreiben` merkt jede Löschung in `events-geloescht` (90 Tage), `eventNeu` darf nie ein gemerktes Event neu anlegen. **Runde:** `zuQualifizieren` führt SQL-bereite Leads ohne Entscheidung zuerst (`sqlEntscheidungOffen`); `ausscheidenGesperrt` für Raus/Parken (Server + Dialoge). **Besuchte Events:** `zaehltAlsBesucht` (Erfassung = besucht, datumsunabhängig), Follow-up-Quote = rechtzeitig (≤ 2 Tage) nachgefasst / erfasst ohne Verzicht, Definition `FOLLOWUP_QUOTE_DEFINITION` überall als Tooltip. Mobile Tippziele: Klassen `.quali-flaeche`/`.quali-seite`/`.os-fenster`/`.deal-anlegen`/`.bes-akte` in `app/globals.css` (`min-height … !important`, Chips tragen ihre Höhe inline). Tests `tests/praxis-fix.test.ts`.

## Kalender-Oberfläche (components/os/kalender, seit 27.09.)
- `/os/kalender` = `Kalender.tsx` (Tag/4 Tage/Woche/Monat/Jahr/Termine; Modi Planen/Aufgaben seit K5). Daten nur über `useKalender` (`/api/kalender`), Schreiben nur über `/api/kalender/termin` (iCloud) — nie mehr über `/api/apple-calendar/create`.
- Zeiten sind Berliner Wandzeit `YYYY-MM-DDTHH:mm:ss` (`lib/kalender/zeit.ts wandAus`), Raster 15 Minuten. Überlappung über `lib/kalender/layout.ts spaltenLegen`.
- Schnelleingabe `lib/kalender/schnell.ts` (rein, getestet) — neue Muster dort ergänzen, nie im Dialog parsen.
- Serien/Erinnerungen entstehen beim Anlegen (`rruleText`, VALARM); Ändern von Serien bleibt in Apple (`aendereTermin` lehnt ab).
- **K2 Quellen & Auswertung (29.09., nur lokal):**
  - **Kalender-Kern `lib/zeit/kalender-kern.ts` = EINE Stelle** für Tag (`berlinerTag`, `tagPlus`), Wandzeit, ISO-Kalenderwoche (`kalenderwoche`, `isoWoche` mit Wochenjahr), `montagVon`, `wochentag`, Feiertage NRW (`feiertageIm`, `feiertag`, `feiertagsHinweis` — gerechnet nur in `lib/aufgaben/feiertage.ts`) und Werktag (`istWerktag`, `werktagAbOder`, `werktagePlus`). Die früheren KW-/Montag-Rechnungen (crm/marketing, crm/scoreboard, aufgaben/ansichten, aufgaben/wiederholung, zeitmessung/einheiten, planung/zeitraum, kalender/layout, Kalender.tsx) reichen nur noch weiter; Steuertermine (§ 108 AO) und Angebots-/Power-Hour-Werktage rechnen jetzt mit Feiertagen NRW. Neue Datumsrechnung nur dort.
  - **Quellen „Feiertage NRW“ (grün `#33B679`) und „Geburtstage“** als eigene, schaltbare Kalender in allen Ansichten: im Browser `components/os/kalender/quellen.tsx` (`QuellTermin` = KTermin + `quelle/farbe/href/space/hinweis`, ganztägig, schreibgeschützt; Klick öffnet nie das Termin-Fenster — Geburtstag → Person/Kontaktakte), Server `GET /api/kalender/quellen?von&bis[&space]` (≤ 400 Tage).
  - **Geburtstag — eine Stelle je Person:** Format NUR `lib/kalender/geburtstag.ts` („TT.MM.“ oder „JJJJ-MM-TT“, `geburtstagSaeubern` prüft Kalender/Zukunft). CRM `Kontakt.geburtstag` (optional, Zweck-Hinweis „nur zum Gratulieren“, in PIPELINE_FELDER → Import fasst ihn nie an, Export-Spalte GEBURTSTAG, Art. 15/17 mit der Kartei) und Familie `Mensch.geburtstag` (+ `kontaktId`); in der Familie **führt der Mensch** — `WichtigerTag(art:'geburtstag')` trägt nur `menschId` (Datum leer, `tagDatum`/`wichtigeTage(…, menschen)`). Familie↔CRM (verknüpft oder gleicher `normName`) erscheint EINMAL, **Vorrang Familie** (`quellenVereinen`). Lesen für ALLE Module nur über `geburtstageIm({von,bis}, person, {nur?})` (`lib/kalender/quellen-geburtstage-server.ts`): CRM über `kontakteFuerVerarbeitung()` (Art. 18 fehlt), Familie nach `sichtFuer` („nur ich“).
  - **Angehängt:** Glocke (abgeleitete Meldung `geburtstag` am Vortag/Tag, nie gespeichert, `geburtstagAbleiten` in lib/meldungen/regeln.ts; CRM nur an die Person, die die Beziehung hält; ETag trägt `kontakte` + `familie--<haushalt>`), Heute (`Anlaesse`: Feiertag heute/morgen + Geburtstage 7 Tage), ZOE (`Brain.anlaesse` im Termin-Block), Kontaktakte (Feld + Vorschlag „Gratulieren vormerken“ → nächster Schritt, nie automatisch), Familie (🎂 je Mensch, Wichtiger Tag „Wessen Geburtstag“).
  - **Zeit-Auswertung** rein in `lib/kalender/auswertung.ts` (`wocheAuswerten`, `zeitAuswertung` + 4-Wochen-Schnitt, `auswertungMarkdown` für den Brain-Spiegel `_App/Woche`): Berliner Woche in echter Zeit (Zeitumstellung 167/169 h), je Minute genau eine Art (abwesend > Meeting > Fokus — nie doppelt), frei = Arbeitszeit (Einstellungen, Mo–Fr, ohne Feiertage) − belegt, Privat/Business, je Firma/Mandat, Kontakte (K3-Schnittstelle `ATermin.kontakte`). Lesen nur in `auswertung-server.ts` (`termineLesen` ohne Abgleich mit `mitBezug` → Art/frei aus dem K1-Modell, Mandat/Kontakt aus `kalender-bezug`; wessen Termine = `betrifft` wie die Verfügbarkeit; Soll-Arbeitszeit aus der Wochenvorlage über `verfuegbarkeitAus`, sonst Einstellungen; `ladeZeit`, `einheitVonBlock`, `mandateKurz`), Route `GET /api/kalender/auswertung?stichtag=`, Oberfläche `Auswertung.tsx` (Leisten-Karte + Fenster).
  - **Jahr + 4 Tage:** `Jahr.tsx` (12 Mini-Monate, lädt verdichtet über `GET /api/kalender/jahr?jahr=` — Zähler je Tag/Kalender + Ganztägiges, private der anderen Person als „Belegt“ (`maskieren`), `lib/kalender/jahr.ts`; die 120-Tage-Grenze von `/api/kalender` bleibt), `VierTage.tsx` (Zeitraster mit 4 Spalten). Umschaltung Tag · 4 Tage · Woche · Monat · Jahr · Termine, Kürzel d/x/w/m/y/a.
  - **Datenschutz-Register:** der Wächter löst jetzt Konstanten, Namens-Funktionen (`familieName(h)` → `familie--*`) und `speicherFuer()` auf (→ `name` + `name--*`). Apple-Spiegel (`calendar-cache`, `kalender-icloud`, `apple-reminders-cache`, `apple-contacts-cache`) sind „ausgenommen: Löschung nur in Apple“ — Art. 17 zählt sie nur (`nurInApple`) und meldet „n Einträge in Apple nennen die Person — dort löschen“.

## Kalender — Termin-Modell und Datenhaltung (K1, 29.09.2026, KALENDER_PLAN.md / KALENDER_VERBINDUNGEN.md 4)
- **Wo was liegt (eine Wahrheit):** iCloud (VEVENT) ist die Wahrheit für den Termin — Titel, Zeit, Zone (TZID + VTIMEZONE),
  ganztags, Ort, Notiz, Serie, Erinnerungen (mehrere VALARM), frei/beschäftigt (`TRANSP`, immer ausdrücklich geschrieben),
  Sichtbarkeit (`CLASS`), Farbe (`COLOR`, RFC 7986: CSS-Name aus `TERMIN_FARBEN`), Art (`X-MAKE-ART`: termin|abwesend|fokus|arbeitsort).
  Der Arbeitsort steht im Titel („Home“, „Büro“ … `arbeitsortAusTitel`). **Bezüge zu MAKE OS stehen NIE im Termin**, nur im
  verschlüsselten Neben-Bestand `kalender-bezug` (`lib/kalender/bezug.ts` rein, `bezug-server.ts` Sperre): Schlüssel
  `kalender|uid` bzw. `kalender|uid::RECURRENCE-ID` (seit R-K1: Kalender-Kennung = letztes Stück der Kalender-Adresse; alte
  Schlüssel `uid` bleiben lesbar, eindeutige zieht der Abgleich um — `bezugVon`, `bezugUmzugPlan`), Inhalt nur Kennungen (`kontaktId/firmaId/mandatId/dealId/aufgabeId/eventId`), `von` (wer angelegt
  hat = Eigentümer für „privat“), `tag` (Starttag) und eine **Sicherung** von Art, „privat“ und Farbe — Apple verliert X-Eigenschaften
  und CLASS, wenn man in Apple bearbeitet. Lesen (`mitBezug`): iCloud gewinnt, die Sicherung füllt nur Fehlendes; privat gilt,
  wenn EINE Seite privat sagt. Abgleich nach jedem iCloud-Lauf (`bezuegeAbgleichen` in `abgleichen`): Termine mit X-MAKE-ART
  ohne Eintrag bekommen ihre Sicherung. Register: `kalender-bezug` (dritte, entfernen → `kalenderBezugOhne`), `kalender-icloud`
  (ausgenommen: Spiegel, Löschung nur in Apple).
- **Aufgabe als Termin = dieselbe Aufgabe** (kein iCloud-Termin, keine Kopie): `Task.dueDate` + `Task.dueTime` („HH:MM“, nur mit
  Deadline — Säuberung, Schreibweg und Systemschreiber entfernen sie ohne Deadline; Verlauf „2026-10-02 14:30“). Angelegt über
  `aufgabeAnlegen` (TasksContext — ausstehend bis der Server bestätigt).
- **Fokuszeit ↔ Zeitmessung:** „Fokus starten“ am Termin → `fokusFuerTermin` (lib/zeitmessung/fokus-laufend.ts): Label = Titel,
  Bereich `fokuszeit`, Aufgabe/Mandat/Einheit wie im Fokus-Kopf, `terminUid` am laufenden Fokus und am Block (bleibt beim
  Umzuordnen). Läuft schon ein Fokus, wird nichts ersetzt.
- **Termin-Route** `/api/kalender/termin`: Eingaben rein in `lib/kalender/eingabe.ts`; Build-Kennung (`bauPruefen`); jede
  Schreibaktion ins Änderungsprotokoll (`kalender`/`termine`, UID + Feldnamen, nie Titel); PATCH/DELETE mit `stand` (ETag aus
  GET) → veraltet 409 `{ konflikt, aktuell }` (`KalenderKonflikt`) statt still überschreiben. Bezug-Änderungen gehen auch an
  Serien/Einladungen (nur Neben-Bestand, kein iCloud-Schreiben); Termin-Felder dort weiter nur in Apple.
- **Privat:** GET `/api/kalender` maskiert private Termine der ANDEREN Person (`maskieren`: „Belegt“, ohne Ort/Notiz/Bezug/Farbe,
  nie änderbar). `calendar-cache` trägt `art`, `beschaeftigt`, `privat`, `von` — die Leser (Heute, ZOE, Signale) müssen selbst
  maskieren (K6). Fristen tragen `bereich`; Sicht/Bereich filtert die Oberfläche.
- **Verfügbarkeit an EINER Stelle:** `verfuegbarkeitFuer(person, von, bis)` (lib/kalender/verfuegbarkeit.ts, rein in
  `verfuegbarkeit-regeln.ts`): Abwesend (ganz/zeitlich, Titel nur wenn nicht privat), Arbeitsort, beschäftigt (TRANSP), Soll-
  Arbeitszeit aus der Wochenvorlage (`routinen.bloecke`, art business), Feiertage NRW; `istFrei`. Gemeinsamer Kalender:
  Abwesend/Arbeitsort nur für `von`. Genutzt von K4 (freie Zeit, Buchung), künftig Heute/Glocke/ZOE.
- **Zeitzonen** (`lib/kalender/zeitzone.ts`): intern bleibt alles Berliner Wandzeit; eine andere Zone nur beim Anlegen
  (Eingabe in jener Zone, TZID + VTIMEZONE aus den Zonendaten der Laufzeit) und in der Anzeige („GMT-04“). Nie `new Date(wandzeit)`.
- **Kern & Abgleich (R-K1, 29.09., KALENDER_FEHLER_ABGLEICH.md „Nachtrag Paket R-K1“):** Zeiten werden aus Wandzeit-Teilen
  geschrieben und über Intl gelesen (RFC 5545: doppelte Stunde = erstes Vorkommen, Lücke vorwärts); jede TZID wird vor dem
  Parsen auf IANA abgebildet (auch ohne VTIMEZONE, Windows-Namen, `/mozilla.org/`-Präfixe; IANA vor eingebetteter Zone);
  floating = Berliner Wandzeit; `Termin.startMs` sortiert. `Termin.id` = `kalender|uid(::RID)` — Ändern/Löschen über
  `objektSchluessel(termin)`; eine alte reine UID in mehreren Kalendern → 409. `status`/`abgesagt` (CANCELLED, eigene Antwort
  DECLINED) belegen nicht. Abgleich: 403/gekürzt nur diesen Kalender überspringen (`hinweise`), 401 = Anmeldung, Backoff mit
  Retry-After (`pauseBis`), `abgleich` (vor X Min., veraltet ab 30) in `GET /api/kalender` und im HOI; ohne ETag nie blind;
  Zeitüberschreitung beim Anlegen → erst nachsehen, dieselbe UID. Tägliche Sicherung je Kalender als ICS (verschlüsselt,
  Archiv, 14 Tage, Fenster −400 … +800 Tage, NICHT im Nachtarchiv — `deploy/sicherung.sh` schließt `archiv/kalender-export-*`
  aus; `lib/kalender/sicherung*.ts`; Takt gestaffelt über `lib/kalender/takt-jobs.ts`: höchstens ein iCloud-Job je Takt,
  Sicherung nur 03:00–05:00, frühestens 30 Min. nach dem Start, nie in einer iCloud-Pause — U1 H2/M4), Zurückspielen nur mit
  Probelauf/Bestätigung, nie Termine mit Gästen (`/api/kalender/sicherung`). Kalender-Tests zusätzlich mit `MAKE_OS_TEST_TZ=UTC` bzw. `=America/Los_Angeles`.
- **Wiederholung voll** (`lib/kalender/wiederholung.ts`, client-sicher): Intervall, Wochentage, Monatstag/letzter Tag/n-ter
  Wochentag, Anzahl, bis (ganztägig: UNTIL als Datum); Vorlagen wie Google (`wiederholungVorlagen`), Text `wiederholungBeschreiben`.
- **Verbindungsprüfung** (`lib/crm/verbindungen-kalender.ts`): `termin-uid-tot` (Bezug zu in Apple gelöschtem Termin, nur im
  Holfenster eines gelungenen Stands), `kalender-bezug-kennung-tot`, `termin-art-verloren` (Hinweis), `zeit-termin-tot`.
- **Oberfläche (K1):** „Erstellen ▾“ (Arten, Kürzel `c`/`n`) → `NeuerTermin.tsx` wie Google (Titel, Reiter, Zeit + „GMT+02“,
  „Wiederholt sich nicht ▾“ + Benutzerdefiniert, Ort, Beschreibung, Kalender + Farbe, Zeile „Beschäftigt · Sichtbarkeit ·
  Erinnerung“, „Weitere Optionen“ = Zone, frei/beschäftigt, Sichtbarkeit, mehrere Erinnerungen). Formular → Anfrage NUR in
  `lib/kalender/formular.ts`. Entwurf im Sitzungsspeicher (`make-kalender-entwurf`) bis der Server bestätigt — beim nächsten
  Öffnen „Wiederherstellen/Verwerfen“. CRM-Bezug und Gäste stehen seit K3 fest im Dialog (Abschnitt „Kalender — CRM,
  Aufgaben und Gäste am Termin“).
  Raster: Klick = Standarddauer, **Aufziehen** = Spanne (`ziehSpanne`/`spanneText` in layout.ts; Touch nach 350 ms Halten, die
  Liste rollt dann nicht), Arbeitsort-Leiste je Person über den Tagen (Klick auf „+“ legt an), Abwesend rot schraffiert (ganztägig
  über die ganze Spalte), Fokus ◎ (▶ solange er läuft), frei gestrichelt, privat der anderen „Belegt“, vorläufige Buchungen (K4)
  gestrichelt (`istVorlaeufig`: NUR das Feld `vorlaeufig`, die Buchung über `buchungId` — seit K3 kein Kennungs-Präfix), Aufgaben mit `dueTime` als Block (Dauer
  `einst.dauer.aufgabe`). Termin-Fenster: Art/Farbe/frei/Sichtbarkeit änderbar, „▶ Fokus starten“; Änderungen mit `stand` —
  409 zeigt die andere Fassung, „Meine Fassung speichern“ schickt NUR meine Änderungen auf den neuen Stand; Entwurf
  `make-kalender-aenderung:<uid>` merkt sich seine Ausgangsfassung. Sicht/Bereich: Aufgaben nach verantwortlich/beteiligt
  (Gemeinsam = mehrere Personen), Fristen nur in „Alle“/„Gemeinsam“, alles nach Bereich (Kalender → `spaceVonKalender`,
  Aufgabe → `spaceVonAufgabe`, Frist → `bereich`).
  **Bedienung (R-K2, 29.09.):** Termine/Blöcke im Raster auf Touch erst nach 350 ms Halten ziehbar (vorher rollt der Finger);
  nach Verschieben/Dauer 8 s „Rückgängig“ (`components/os/kalender/verschieben.tsx` `useVerschieben` — schreibt die alte Zeit
  über denselben PATCH mit frischem `stand`, 409 → Meldung). Mehrtägige Termine mit Uhrzeit ziehen als Differenz auf Start und
  Ende (`verschiebeDifferenz`), Dauer nur am letzten Segment (`endeAmTag`, layout.ts). Ab 4 Spalten „+n“ (`rasterLage`,
  Klick klappt den Tag auf), Band „2–3 Uhr doppelt/entfällt“ an der Zeitumstellung (`zeitumstellung`), Blöcke ≥ 24 px
  (`MIN_HOEHE`; Kontrast der Art-Farben geprüft in `tests/kalender-rk2.test.ts`). Agenda: mehrtägige „läuft weiter“
  (`laeuftWeiter`). Suche überall `suchPasst` (Umlaute). Einstellungen „zählt als belegt“ + freie Tage: `EinstellungenBelegt.tsx`.
## Kalender — Ein Kalender: Planen, Aufgaben, Spiegel (K5, 29.09., nur lokal — KALENDER_PLAN.md Entscheidung 8)
- **Modus in der Adresse** (`lib/kalender/modus.ts`, rein): `?modus=planen` (Kalender-Seite, dasselbe Zeitraster, Taste p) ·
  `?modus=aufgaben` (Umschalter oben rechts wie Google: Kalender | Aufgaben, `components/os/KalenderAufgabenSchalter.tsx`,
  Tasten k/u; auch in `/os/aufgaben` mit Space/Projekt/Filter → `kalenderLink`) · `tag`, `space`, Aufgaben-Filter `as/ap/al/wer`.
  Aufgaben schließt Planen aus (Planen ist ein Unter-Modus des Kalenders). Neue Links: `WEG.woche(tag)` (Planen), `WEG.kalender(tag)`.
- **Ein Block IST ein iCloud-Termin** (`lib/planung/bloecke.ts`): Fokus = `X-MAKE-ART:fokus`, sonst `X-MAKE-ART:block` +
  Unterart `X-MAKE-BLOCK` (reha|routine|pause|aufgabe; `blockArt` in ics/eingabe/Termin-Route), eingeplante Aufgabe nur als
  `kalender-bezug.aufgabeId` (die Deadline der Aufgabe bleibt — „Aufgabe mit Uhrzeit“ ist K1/K3). Blöcke sind beschäftigt;
  wer nur für sich plant, stellt im Termin-Fenster auf „frei“ (TRANSP). **Kein Kalender „Planung“** (MAKE OS legt keine
  iCloud-Kalender an; ein zweiter Kalender wäre eine zweite Wahrheit für „wem gehört das“) — Blöcke liegen im Kalender der
  Person. Verschieben/Dauer/Löschen = Termin ändern (ETag) — der Apple-Spiegel des alten Wochenplans (Befund 5) ist weg.
  `block` steht in `ICS_ARTEN`, NICHT in `TERMIN_ARTEN` (kein Reiter im Anlege-Dialog). Farbe im Raster je Unterart (`blockFarbe`).
- **Planen-Oberfläche** `components/os/kalender/Planen.tsx` (`usePlanen`): Stunden des Zeitraums (`wochenStunden`: Termine vs.
  Blöcke, frei/Arbeitsort zählen nicht) + je Tag, Bausteine/Routinen/„Aufgaben einplanen“/„Eigener Block“ — **antippen, dann in
  den Kalender klicken oder aufziehen** (kein HTML-Ziehen: geht am Handy nicht), ZOE-Vorschlag (legt erst auf Klick an),
  Fokus + Ziele, Übernahme-Karte. `Kalender.tsx` fragt `planen.platzieren` vor dem Anlege-Dialog.
- **Blöcke lesen: NUR `planBloeckeLesen`** (`lib/planung/bloecke-server.ts`, ohne Netz über `termineLesen`, `gehoertZu` je Person,
  `betrachter` maskiert fremde private) bzw. `GET /api/planung/bloecke?von&bis[&fuer]`. Leser: Gesundheit, Business-Index,
  Risiko (Reha heute), Loops, Ritual, Energie, Tagesplan (schreibt über `/api/kalender/termin`). ZOE `plan_block` → Stapel
  (F2 M8), Freigabe → `blockAnlegen` (Kalender der Person, ohne Person `KEINE_PERSON`); Kollision `blockKollision`
  (lib/planung/bloecke.ts: abgesagte/freie zählen nicht, ganztägige Abwesenheit belegt den Tag, über Mitternacht zählt). Server-Schreiben immer über `lib/kalender/termin-server.ts`
  (iCloud → kalender-bezug → Änderungsprotokoll = Audit), feste UIDs erlaubt (`anlegen({ uid })` → `schonDa` statt doppelt).
- **Übernahme des alten Wochenplans** (`lib/planung/wochenplan-uebernahme(-server).ts`, `/api/planung/uebernahme`, einmal nach
  dem Upload): nur zukünftige Blöcke; vorhandene Apple-Kopie (`appleUid`) wird DER Block, sonst neuer Termin mit fester UID
  `makeos-wochenplan-<person>-<id>`; vorher Archivkopie `archiv/wochenplan-vor-uebernahme-*`, Absicht `wochenplan-uebernahme`
  (Schritte archiv · je Block · abschluss, Wiederaufnahme im Takt). Stand `wochenplan-uebernahme` (nur Kennung → UID). Der alte
  Bestand bleibt unverändert; vergangene (und bis zur Übernahme künftige, `wartet`) Blöcke liest nur `archivBloecke` —
  im Raster gestrichelt/schreibgeschützt (`archiv:…`). `/api/state/wochenplan` → 410. Wächter: `tests/kalender-k5.test.ts`.
- **Spiegel Event/Familie** (`lib/kalender/spiegel(-server).ts`, `POST/GET /api/kalender/spiegel`): das Modul führt, der
  Termin folgt — feste echte UID (`makeos-event-<id>`, `makeos-date-<id>`, `makeos-gespraech-<haushalt>-<datum>`), Kalender
  „Gemeinsam“, Event mit Bezug `eventId`, Ort als Feld, drei Stunden. Nachziehen im Hintergrund nach `/api/crm/bestand`
  (Events) bzw. `/api/familie` (Dates, Gespräche, Einstellungen — Wochentag geändert → der künftige Termin zieht um); abgesagt
  durch eine Person → Termin weg. `Date.kalenderUid`/`einstellungen.kalenderTermine` schreibt NUR der Server (`wendeFamilieAn`/`setzeFelder`
  ignorieren Browserwerte). **Upload U1 B3:** nachgezogen werden nur Termine mit Bezug (von MAKE OS angelegt; Event: `eventId`
  = dieses Event), nur künftige, und nur, wenn sich das Modul seit dem letzten Spiegeln geändert hat — Änderungsmarke
  `kalender-bezug.spiegel` (Hash des Solls, `spiegelMarke`/`spiegelSchritt`); ohne Marke wird sie nur gesetzt (nichts
  geschrieben). Alte Schein-Kennung `mac-…` (Befund 4) → NUR per Klick „Mit dem Kalender verknüpfen“ (Event-Seite) mit dem
  eindeutigen Termin (Tag + Titel) verbunden, nie beim Nachziehen/im Takt. Verbindungsprüfung `event-termin-tot`, `event-termin-schein`, `familie-termin-tot`
  (`lib/kalender/spiegel-verbindungen.ts`); `wochenplan-aufgabe-tot` entfällt (Bezug `aufgabeId` prüft K1 `kalender-bezug-kennung-tot`).
- **Aufgaben-Modus** (`components/os/kalender/AufgabenModus.tsx`): Überfällig · Heute · Diese Woche · Später · Ohne Datum über
  K3 `aufgabenFuerKalender`/`ohneTermin` + Vorfilter (`aufgabenVorfiltern`: Space, Projekt, Liste, meine/beteiligt), Abhaken/
  Einplanen/Öffnen NUR über K3 `useAufgabenImKalender` (Aufgaben-Schreibweg + Rückgängig); Ziehen auf einen Wochentag rechts
  (`AUFGABE_ZIEH_TYP`) oder Datum/Uhrzeit wählen.
- **KEMARIS/M365:** `/api/kemaris-calendar` liefert bis zur echten Anbindung nichts (keine Beispieldaten mehr in Heute,
  Tagesplan, Energie, Signalen, `planung/vorschlag`, Netzwerk); `lib/brain.ts` liest den Bestand noch (Paket R-Z).
- **Oberflächen lesen Termine nur über `/api/kalender`** (maskiert fremde private): Heute-Widget, Tagesplan, Energie, Meeting,
  Fundament-Agenda. Alt-Dashboard `/calendar`, `CalendarContext`, `components/calendar`, `MOCK_CALENDAR_EVENTS` entfernt.

## Netzwerken — Meine Visitenkarten und Schnellaktionen am Handy (02.10., Paket B, nur lokal)
- **Bestand `visitenkarten--<person>`** (`lib/netzwerken/karte-speicher.ts`, Route `app/api/netzwerken/karten`): JE PERSON ein Bestand, die Person kommt aus der Sitzung (`haushaltVon`), nie aus dem Body — „nur eigene Profile“
  ist der Bestandsname. Einzige Ausnahme `?fuer=<person>`: nur der Inhaber (Rolle), nur Personen DES Haushalts, sonst 403; das Änderungsprotokoll (`listePatchen`) trägt `wer` und nie Werte. Änderungen als Einzel-Ops mit Stand
  (409 + aktueller Stand), `bauPruefen`, > 40 Ops oder > 20 Profile → 413 (nie gekürzt), jede Karte vor dem Schreiben durch `pruefeKarte` (Satz je ungültigem Feld → 400). Register: `visitenkarten--*`, eigene Daten, Art. 17 = Profil/Konto löschen.
- **vCard und QR** (`lib/netzwerken/karte.ts`, `qr.ts`): vCard 3.0, CRLF, Maskierung, UTF-8, nur gesetzte Felder (nie Design); gefaltet nur in der .vcf, Logo nur dort und nur als kleines PNG/JPG (PHOTO). QR im Browser (`qrcode-generator`;
  Text vorher als UTF-8-Bytes, sonst Latin-1), dunkel auf weißem Feld mit ruhiger Zone. Test liest den Code mit `jsqr` zurück.
- **Firmen-Design:** Logo (SVG nur nachgebaut aus Positivliste — `lib/netzwerken/svg.ts`, Browser UND Server; PNG/JPG/WebP mit Dateikopf-Prüfung, ≤ 280.000 Zeichen), Farben `hintergrund`/`textfarbe`/`farbe`, Schrift
  `system|urbanist|serif` (Urbanist lokal in `public/schriften/`, OFL). **Karte und Vollbild (`components/os/netzwerken/QrKarte.tsx`) zeigen nur das Profil-Design — kein MAKE-Logo, -Name, -Farben, keine App-Token** (Wächter
  `tests/netzwerken-ansicht.test.ts`; die Datei importiert nichts aus `design.ts`). Neu dort: nie MAKE-Marken einbauen.
- **Handy-Leiste:** „Netzwerken“ (Handschlag) statt „Melden“; „Problem oder Idee melden“ = `MeldenZeile` im Blatt + System-Seite. **Kontaktakte < 1180 px:** `SchnellLeiste.tsx` bündelt die vorhandenen CRM-Wege (kein Zweitweg).
- Offline: Abbild der EIGENEN Profile in `localStorage` `make-karten-cache` (nur wenn kein Funkloch-Ersatz nötig ist, nie für `?fuer`); `karteCacheLeeren()` beim Abmelden.

## Kalender — Termine finden (29.09., Paket K4, nur lokal)
- **Freie Zeit = EINE Lesefunktion, auf K1 aufgesetzt:** WANN jemand da ist, sagt nur K1 `verfuegbarkeitFuer` (beschäftigt/TRANSP, Abwesend, Arbeitsort, Arbeitszeit aus der Wochenvorlage `routinen.bloecke`, Feiertage NRW). `lib/kalender/freie-zeit.ts` übersetzt (`belegungenAus`, `arbeitszeitAus` — ohne Vorlage Mo–Fr 9–18, nicht an Feiertagen/ganz abwesenden Tagen —, `feiertageAus`) und ruft die reine Lückensuche `freieZeiten` (`lib/kalender/verfuegbar.ts`: Arbeitszeit je Tag oder Wochen-Fenster, Belegungen, Puffer, Vorlauf, Raster, max. je Tag; Zeitumstellung über Rundweg `wandzeit(ausWandzeit(x)) === x` + echte Dauer, doppelte Stunde = die spätere). `freieZeitFuer({ personen, dauerMin, … })` nutzen „Mit … planen“ (`GET /api/kalender/frei`), künftig ZOE (`freie_zeit`, nur lesen) und das Angebot. Gehaltene Buchungen zählen als belegt. Nie eine zweite Verfügbarkeits-Rechnung bauen; Feiertage/KW später aus K2 `lib/zeit/kalender-kern.ts` (über K1).
- **Mit … planen** (`components/os/kalender/MitPlanen.tsx`, ein Haken `useTermineFinden` in `Kalender.tsx`): Personen wählen → Termine der anderen halbtransparent im Raster (Farbe gemischt, `gedimmt`), private (`maskiert`/`sichtbarkeit: privat`) nur „belegt“; `FreieZeiten.tsx` → Klick öffnet `NeuerTermin` vorbelegt (`Vorgabe`, gemeinsam → `wer: 'beide'`). Offene Buchungen stehen als `buchung-…`-Einträge im Raster (Klick öffnet die Buchungsseiten-Karte). Arbeitszeiten pflegt man in der Wochenvorlage (`WEG.routinen()`), nicht hier.
- **Buchungsseiten** (`lib/kalender/buchung.ts` rein, `buchung-speicher.ts`, `buchung-ablauf.ts`; Bestand `buchung--<haushalt>` = `karteiHaushalt`): Seite (Titel, Person, Dauer, buchbare Fenster, Vorlauf, max./Tag, Puffer, Zielkalender, Ort, Verantwortlicher, Fragen, aktiv), Adresse `<vorsatz>-<24 hex>` (`neuerSlug`, 96 Bit). Plätze = Fenster der Seite minus K1-Belegung der Person minus gehaltene Buchungen, Feiertage gesperrt. Verwalten nur Haushalt: `GET/POST /api/kalender/buchung` (`seite`, `seite-loeschen` nur ohne Buchungen, `freigeben`, `ablehnen`; nie `tokenHash` in Antworten). Oberfläche `Buchungsseiten.tsx` („Link kopieren“, Anfragen freigeben/ablehnen, Vorschlag, „Termin entfernen“ nach Absage).
- **Ablauf:** vorläufig (30 Min. reserviert) → Gast bestätigt auf `/buchen/<slug>/status#<token>` (Token nur im Fragment, im Bestand nur SHA-256) → angefragt (nur Glocke — seit R-K2 KEIN CRM vor der Freigabe) → Freigabe → bestätigt; Endzustände abgelehnt/abgesagt/abgelaufen. **EIN CRM-Vorgang** über das Absichtsprotokoll (Art `buchung`, `buchungFortsetzen`; Freigabe-Schritte `kontakt · termin · buchung · kartei · crm`): Anfrage (bei der Freigabe, Tag der Anfrage) = `anfrageBauen` (Dublette über `alleAdressen`, `neuanlageSperre`, Einwilligung „anfrage“ mit Wortlaut + Fassung + `belegRef: buchung:<id>`, gestempelt über `datenschutzStempeln`, `hinweisBeiErhebung`; Glocke Art `buchung` schon bei „angefragt“, kein Follow-up „Anfrage beantworten“ mehr); Werbesperre einer vorhandenen Person → nur verknüpfen, Hinweis an der Buchung; Art. 18 → nichts. Freigabe = `anlegen` (Art termin, beschäftigt, echte iCloud-UID, Gast als Notiz — oder seit K3 „Freigeben + einladen …“: nach der Rückfrage mit der Adresse als echte Einladung, `einladen` + `einladungBestaetigt`, Art. 18 → 409, `gastKontakte`; Marke `MAKE-OS-Buchung <id>` für die Wiederaufnahme) + Kontaktbezug NUR in `kalender-bezug` (`bezugSetzen`, nie im Termin) + Audit wie die Termin-Route (`kalender`/`termine`, UID + Feldnamen; Einladung als `einladungen`, Anzahl) + genau EINE Aktivität „Termin gebucht“ als Meeting mit `terminUid` (K3, ohne `wann`; Signal und Bezug-Lauf legen keine zweite an) + Follow-up „Termin vorbereiten“ (Vortag). Deal/Qualifizierung nur als Vorschlag (`folgeVorschlag`). Ohne iCloud keine Freigabe (409). Kartei-Leser nur über `kontakteFuerVerarbeitung` (Art. 18).
- **Datenschutz:** Register `buchung--*` (dritte, entfernen; `person-weitere.ts` `eintraegeRaus('buchungen')`), Frist „buchungen“ (30 Tage, Stammdaten › Datenschutz; Löschfristen-Lauf Schritt 14: Endzustände nach der Frist, bestätigte die Frist nach dem Termin, Protokoll nur Kennungen). Verbindungsprüfung `buchung-seite-tot`, `buchung-kontakt-tot`, `buchung-termin-tot` (`lib/kalender/buchung-verbindungen.ts`, gegen dieselben iCloud-UIDs/Holfenster wie K1). Änderungsprotokoll des Bestands: `buchungProtokoll` (Gast = `system` + Feld „oeffentlich“).
- Tests: `tests/kalender-verfuegbar.test.ts`, `tests/kalender-buchung.test.ts`, `tests/buchung-route.test.ts` (iCloud gemockt, Abbruch nach jedem Schritt), `tests/buchung-middleware.test.ts`.
- **R-K2 (29.09., Kalender-Prüfliste #73/#76/#79/#72/#69/#74):** Plätze nur mit frischem iCloud-Stand (`standBuchbar` über R-K1 `abgleichAlter`: verbunden, nicht veraltet (30 Min.), letzter Abgleich ohne Fehler — dieselbe Grenze wie „letzter Abgleich vor X Min.“ im Kalender-Kopf, `AbgleichStand.tsx` — sonst „Gerade sind keine Termine buchbar“); POST und Freigabe gleichen erzwungen ab (POST höchstens alle 10 s erzwungen), die Freigabe prüft `istFrei` → 409 `{ konflikt }`, im Panel „Trotzdem freigeben · Ablehnen“. **E-Mail des Gasts „unbestätigt“** bis zum Klick auf den Bestätigungslink: Panel „Bestätigungslink senden …“ → `aktion: 'mail-link'` (nie Dienstweg; eigenes Token, `mailTokenHash`, gilt 7 Tage, einmalig, neuer ersetzt alten) → Mail-ENTWURF (`bestaetigungsMail` + `mailtoLink`, Versand per Klick in der Mail-App — MAKE OS verschickt nichts) → `/buchen/<slug>/status#mail=<token>` → Status-Route `mail-bestaetigen`. Nachweis im CRM sagt „unbestätigt“/„bestätigt“ (`nachweisText`; nach der Freigabe bestätigt → zweite Einwilligung, `mailBestaetigtNachtragen`); einladen an eine unbestätigte Adresse nur mit `adresseUnbestaetigt` (Warnhinweis), nie ein Mail-Follow-up. `verantwortlich` Pflicht (Seite ohne → keine Plätze), Datenschutz-Hinweis ausgeklappt über dem Formular — Text `DATENSCHUTZ_HINWEIS` muss zum Verhalten passen (Fassung hochzählen). Gesperrt: Feiertage NRW + „frei, aber nicht gesetzlich“ (Kalender-Einstellungen `freieTage`, Standard 24.12./31.12., `lib/kalender/freie-tage.ts`, `sperrTageAus`; auch freie-Zeit-Suche). „Zählt als belegt“ je Kalender (`belegt`, `lib/kalender/belegt.ts` `werFuerBelegung`): nicht zugeordnete Kalender blockieren niemanden. Gast-Zeitzone nur im Browser (`lib/kalender/gast-zeit.ts`, zweite Uhrzeit). Tests `tests/buchung-rk2.test.ts`, `tests/kalender-rk2.test.ts`.

## Kalender — CRM, Aufgaben und Gäste am Termin (30.09., Paket K3, nur lokal)
- **CRM am Termin — eine Quelle:** Dialog und Termin-Fenster „Mit Kontakt, Firma, Mandat oder Deal verknüpfen“ (`TerminVerknuepfen` in `components/os/kalender/verknuepfen.tsx`, Schnellsuche `crmSuchen` über `GET /api/aufgaben/crm`, eingeschränkte fehlen). Gespeichert NUR in `kalender-bezug` (Kennungen; Gäste aus dem CRM als `gastKontakte`, nie Adressen; `kontakteVon(b)`). Folgen in `lib/crm/termin-aktivitaet.ts` (rein) + `-server.ts`: je Kontakt und Termin/Vorkommen GENAU EINE Aktivität „Meeting“ mit `Aktivitaet.terminUid` (= `uid` bzw. `uid::RID`), idempotent, **ohne `wann`** — Zeit/Ort liest die Akte über den Verweis (`GET /api/kalender/bezug` → `zeiten`, `meetingVon(a, termine)`, Hook `useTerminZeiten`); verschoben → neue Zeit. Vergangen → zählt sofort als Kontakt; geplant erst, wenn vorbei (`terminKontaktNachziehen` im Signal-Lauf). Kontakt gelöst oder Termin gelöscht, solange er in der Zukunft lag → Meeting weg (Löschmarke). Serien: Vorkommen legt der Signal-Lauf an. Art. 18 → nichts; Werbesperre → Meeting ja (1:1). Privat → Text „Meeting (privat)“. Deal am Termin → `bezug` der Aktivität (Deal-Ampel).
- **`Aktivitaet.wann` = EIN Format:** Berliner Wandzeit `YYYY-MM-DD` oder `YYYY-MM-DDTHH:MM`; `wannSaeubern` rechnet ISO mit Zone um (`wannNorm` auch für Altbestand beim Lesen). Nie `new Date(wandzeit)`.
- **Doppelzählung weg (Befund 7):** das Kalender-Signal (`lib/crm/signale.ts`) ordnet über den Bezug zu (`TerminEin.kontaktIds`, Termine mit Bezug aus JEDEM Kalender) und legt für sie NIE eine Aktivität an; der Name im Titel ist nur Rückfall (Holding-Kalender) und überspringt Termine, zu denen es ein Meeting mit der UID gibt. Zeitvergleich `terminMs` über `ausWandzeit` (Befund 11). „+ Meeting“ (Kontaktakte links + Reiter Aktivitäten, `MeetingNeu`) = echter Termin über den Anlege-Dialog. `verlaufZahlen` zählt ein Meeting einmal (`gespraechSchluessel`: `terminUid`, Altbestand Signal + von Hand am selben Tag).
- **Akten:** `TermineAkte` (components/os/kalender/TermineAkte.tsx) in Kontakt (rechts), Firma (Firma + Personen + Deals + Mandate), Deal-Akte, Mandat — kommend/vergangen, Klick → `WEG.termin(id, tag)` (Kalender öffnet über `useTerminAusAdresse`); vergangen ≤ 14 Tage → Knopf „Nachbereiten“ (Vorschlag, erst der Klick legt das Follow-up an). Meetings im Reiter Aktivitäten: „im Kalender ›“.
- **Aufgaben im Kalender (Befund 9):** Regeln rein `lib/kalender/aufgaben.ts` (ohne Abgebrochene/Papierkorb/Archiv/fremde „nur ich“, Balken Start → Deadline `abschnittAm`, Unteraufgaben `eltern` „↳“, `einplanenTeil`: Deadline + Uhrzeit, Start wandert mit, `ohneTermin`), Bausteine `components/os/kalender/aufgaben.tsx` (`aufgabeImKalenderAbhaken`, `aufgabeEinplanen`, `useAufgabenImKalender`, `OhneTerminListe`, Ziehen mit eigenem Typ `AUFGABE_ZIEH_TYP`) — auch für den Modus „Aufgaben“ (K5). Schreiben NUR über den Aufgaben-Schreibweg mit „Rückgängig“/Rückfrage (`HandlungProvider` in `app/os/kalender/page.tsx`). Tag/Woche/4 Tage: Haken, Klick öffnet `WEG.aufgabe`, Ziehen ins Raster = Deadline + Uhrzeit, in die Ganztags-Zeile = ohne Uhrzeit; Monat (auf einen Tag ziehen, Uhrzeit bleibt) und Termine-Liste zeigen Aufgaben; Seitenkarte „Ohne Termin“ (ziehen plant ein). Ziehen ist HTML5 (am Handy: Aufgabe öffnen).
- **Gäste (Kevin: „Echte Einladung nach Klick“, KALENDER_FEHLER_PRUEFLISTE #57/#59/#60/#61/#63/#K2):** Dialog und Termin-Fenster `GaesteWahl` — aus dem CRM (`GET /api/kalender/gaeste?q=`, Adressen nur auf Anfrage, max. 8, Art. 18 fehlt, Werbesperre mit Hinweis) oder frei. Speichern mit Gästen zeigt ERST `EinladungFrage` („Einladung an n Personen über iCloud senden?“ + Adressen); erst dann `einladungBestaetigt: true`. Server: `lib/kalender/icloud.ts` wirft `EinladungNoetig` (409 `{ einladung, anzahl, adressen }`) VOR jedem PUT/DELETE mit Post an Gäste; ORGANIZER = `calendar-user-address-set` des Kontos (`kontoAdressen`, Rückfall Apple-ID), ATTENDEE mit `SCHEDULE-AGENT=SERVER`, PARTSTAT bleibt bei geänderter Liste; SEQUENCE bei Gästen nur für Zeit/Ort; als Gast nur `antwortSenden` (PARTSTAT). `gaestePruefenCrm` (lib/kalender/gaeste-server.ts): eingeschränkte Person nie — auch nicht per frei eingegebener Adresse (liest dafür die ganze Kartei), freie Adresse einer einzigen Person → deren Kennung. Protokoll: Listen `einladungen`/`antworten` mit UID + `gaeste:n` — nie Adressen. Termine mit Gästen verschieben sich nicht per Ziehen (Fenster mit Rückfrage). Zusagen/Absagen am Termin (`Termin.teilnehmer`, `meineAntwort`, `antwortenZaehlen`). Auswertung: `ATermin.kontakte` = Kontakt + Gäste. Art. 17: `kalenderBezugOhne` nimmt die Person auch als Gast heraus; die Adresse steht nur im Apple-Spiegel („in Apple löschen“).
- **Verbindungsprüfung:** `aktivitaet-termin-tot` (Meeting zeigt auf einen in Apple gelöschten Termin — nur bei gelungenem Stand, Bezug-Tag im Holfenster oder ohne Bezug-Eintrag; Reparieren löst nur den Verweis).
- Tests: `tests/kalender-k3-route.test.ts` (DAV gemockt: ohne Bestätigung kein PUT, Dienstweg 403, Art. 18, Ändern/Löschen/Antwort, Meeting-Aktivität), `tests/kalender-k3-crm.test.ts`, `tests/kalender-k3-aufgaben.test.ts`.

## Kalender — Verbindungsrunde außerhalb des Kerns (29.09., Paket K6a, nur lokal — KALENDER_VERBINDUNGEN.md, Status)
- **Meeting-Zeit NUR aus dem Termin:** EINE Abbildung in `lib/crm/aktivitaeten.ts` — `zeitenAus` (Schlüssel neu + alt, maskierte
  fallen heraus), `mitTerminZeit`/`kontakteMitTerminZeit` (setzen `wann`/`ort` NUR für Anzeige/Datenpakete — nie speichern).
  Server: `lib/crm/termin-zeiten-server.ts` (`terminZeitenLesen(person)`, `kontakteMitTerminZeitenLesen`, ohne Abgleich,
  maskiert je Person). Genutzt: GET /api/kalender/bezug, ZOE-CRM-Werkzeuge (`sicher` → `mitTerminZeiten`), Heads (lauf + Route;
  Signal „Meeting geplant am …“), `Verlauf` (Prop `termine`, Kontakt „Letzte Aktivitäten“ + Verlauf-Reiter), „Wie lief's?“.
- **„Wie lief's?“ (`nachbereitung`, lib/crm/erfassen.ts)** kennt beide Wege: Signal-Aktivität (Altweg) und Meeting mit `terminUid`
  (Zeit/Titel/abgesagt aus dem Termin, erst wenn vorbei — `termine`, `jetztWand`). Power Hour holt die Zeiten aus
  `/api/heute/anstehend` (`nachbereitZeiten`).
- **Glocke & Heute = eine Quelle:** `lib/heute/anstehend.ts` (rein) + `anstehend-server.ts` (`anstehendLesen`, `anstehendStand` mit
  10-Min.-Uhr) → Route `GET /api/heute/anstehend` (eigene Person, ETag) und Glocke (`anstehendAbleiten` in lib/meldungen/regeln.ts,
  Arten termin ≤ 2 h · nachbereiten · frist · followup · vorschlag — abgeleitet, nie gespeichert, Gelesen je Tag). Heute-Karte
  `components/os/heute/Anstehend.tsx` („Steht an“: Nachbereiten, Fristen, Follow-ups, Buchungsanfragen, ZOE-Kalender-Vorschläge,
  Geburtstage). Follow-ups ohne Kadenz und ohne verknüpfte Aufgabe (die Aufgabe führt). Buchungsanfragen meldet die Glocke
  schon beim Eingang (gespeicherte Art „buchung“).
- **F2 (29.09., Prüfung 2):** Geburtstage stehen auf Heute NUR in „Steht an“ (`Anlaesse geburtstage={false}`), ab heute, Sichtregel
  `geburtstagFuer` (lib/kalender/geburtstag.ts) auch in der Glocke. Geschenk-Vorlauf: Familie → der „Wichtige Tag“ (`anlass`:
  Vorlauf, Aktion, erledigt je Jahr; ohne ihn „Geschenk vormerken“ = legt ihn mit `menschId` an); CRM → Aufgabe mit
  `bezug.kontaktId` + `Task.anlass { art: 'geschenk', jahr }`, erkannt über `geschenkStand` (nie per Titel; Papierkorb/Archiv/
  abgebrochen zählen nicht), Titel nur „Geschenk für …“. Mandats-Review nur als Follow-up `v:review` (Frist `review: true` nur in
  der Kalenderansicht, Regel `reviewZaehlt` lib/crm/review.ts: pausiert = kein Review). ZOE-Vorschläge in Heute nur der Person
  (`vorschlagSichtbar`). Maskierte Termine fehlen in Heute/Glocke. `nachbereitZeiten` nur für eigene Kontakte. Offenes
  Follow-up mit derselben `terminUid` = Nachbereitung in Arbeit (keine Doppelmeldung); Follow-up-Text ohne Titel/Datum, die
  Anzeige leitet ab (`followupAnzeige`). Glocken-Quellen gemerkt (`merken`, 60 s); ETag mit `steuern` und Familie.
  Offen (bewusst): private Termine ohne Eigentümer im Kalender „beide“ bleiben sichtbar (kein `von`, kein Eigentümer).
- **Fristen an EINER Stelle:** Quellen lädt NUR `lib/kalender/fristen-server.ts` (`fristenLesen`, auch GET /api/kalender);
  gerechnet in `eintraege.ts fristen(q, von, bis, heute)`. Kündigungsfrist/Periodenende NUR `mandatFristen` (lib/crm/kunden.ts,
  auch `mandatLage`) — `kuendigung`, `fuer` (zuständig). Dazu DSGVO-Anträge (ohne Namen), Angebote „gültig bis“, Deals
  „Entscheidung bis“, Werktag-Hinweis an Zahlungen (§ 193 BGB), Steuertermine als VORLAGE: Schalter
  `kalender-einstellungen.steuerVorlage.an` (Standard aus, Schalter im Steuer-Modul „Fristen“), Termine aus `lib/steuern` (eine
  Quelle, § 108 AO), nie Beträge, Hinweis `STEUER_HINWEIS`. Vorlauf der Kündigungsfrist: `kuendigungVorlaufTage` (14).
- **Nachfassen — eine Leseregel:** `faellige` (lib/crm/followup.ts) kennt jetzt die Wiedervorlage geparkter Deals
  (`v:dealwiedervorlage:<id>`, Regel `dealWiedervorlagen`, auch in `werIstDran`); verschieben/erledigen setzt die nächste
  Wiedervorlage am Deal (+90 Tage ohne Angabe), absagen → 400. Der Datenumzug der Altfelder zu echten Follow-ups ist offen.
- **Follow-up am Termin:** `FollowUp.terminUid` (Schlüssel wie `Aktivitaet.terminUid`); die Verbindungsprüfung zieht den Vortag
  nach (`followup-termin-verschoben`, von Hand verschobene bleiben) und verknüpft „Termin vorbereiten“ bestätigter Buchungen
  (`buchung-followup-ohne-termin`) — Buchungen selbst fasst sie nicht an (R-K2). Seit F2 setzt die Freigabe `terminUid` gleich
  (Text ohne Datum), „Neu zuordnen“ hängt Follow-ups mit um, `followup-termin-tot` („Vom Termin lösen“) räumt Verweise auf
  gelöschte Termine; „Nachbereiten“ in der Akte legt das Follow-up mit `terminUid` an (Text „Termin nachbereiten“).
- **Familie (F2 N4):** `Mensch.kontaktId` entfernt (kein Schreibweg, keine Pflege) — Familie ↔ CRM nur über gleichen Namen.
  Verbindungsprüfung `familie-tag-mensch-tot` (lib/crm/verbindungen-familie.ts): Wichtiger Tag mit totem `menschId` → entfernen
  (mit eigenem Datum nur der Verweis). `app/api/netzwerk/verlauf` ist entfernt (F2 M7: kein Aufrufer).
- **Verbindungsprüfung K6a** (`lib/crm/verbindungen-termine.ts`): `event-termin-verwaist` („Termin entfernen“ — iCloud über
  `terminLoeschenServer`, nach Vorschau/Rückfrage, nie mit Gästen, nie ein Serien-Vorkommen), `termin-waise-neu` (#100: gelöschter
  Termin mit CRM-/Aufgaben-Bezug + genau EIN neuer Termin gleichen Titels ±1 Tag → „Neu zuordnen“ hängt Bezug
  (`bezuegeUmhaengen`) und Meetings um; Titel nur aus „Meeting: …“ bzw. Aufgabentitel). Reparatur vor K1 (Meetings sonst „tot“).
  Loader `ladeTermineStand` (Holfenster, Titel nur zum Vergleichen).
- **Event-Spiegel im Takt:** `eventSpiegelImTakt` (lib/kalender/spiegel-server.ts, alle 30 Min. aus /api/zoe/takt, gestaffelt über
  `lib/kalender/takt-jobs.ts`) — Änderungen am Event ohne Bestand-PATCH (ZOE, Heads) ziehen den Termin nach (U1 B3: nur eigene,
  künftige, geänderte). Eine Absage LÖSCHT im Takt nie: einmal Glocke (Art `kalender`, an die Zuständige bzw. den Haushalt, Marke
  `weg`), gelöscht wird per Klick „Termin im Kalender löschen“ auf der Event-Seite (`POST /api/kalender/spiegel { art: 'event',
  id, aktion: 'loeschen' }` → `eventSpiegelLoeschen`).
- **ZOE `freie_zeit`** (nur lesen, Register frei, `LESEND`): `freieZeitFuer` — nur Zeiten, nie Titel; legt nichts an. Angebot:
  `components/os/crm/angebot/TerminVorschlag.tsx` („Termin zum Besprechen vorschlagen“ → freie Zeit → Termin-Entwurf mit
  Kontakt/Firma/Deal; erst „Speichern“ legt an).
- **Zeit-Auswertung:** Planen-Blöcke (`X-MAKE-ART:block` + `X-MAKE-BLOCK`) = Kategorie `block` (Vorrang unter Fokus),
  `minuten.bloecke`, `jeBlock` je Unterart (`BLOCK_NAME`). `_App/Woche` enthält die Zeit einer Person NUR mit ihrer Einwilligung
  (F2 H1: `brain-bruecke--<haushalt>.zeitFreigabe`, Standard leer; POST /api/brain/app `{ zeitAuswertung: true|false }` nur für
  sich selbst) — ohne Kontakte; `appDatenLaden(…, { mitZeit: true })` nur im Spiegel, der Riegel kennt `zeitBestaende` (Kalender-
  Stand, `zeit`/`zeit--<p>` der Eingewilligten). Termin-Zeiten für Modellpfade (`terminZeitenLesen`) nach `fuerZoe`; `termineFuerZoe`
  lässt abgesagte weg.
- Tests: `tests/kalender-k6a.test.ts`, `tests/crm-verbindungen.test.ts` (4 neue Prüfungen), `tests/brain-app-bruecke.test.ts`.

## Kalender — Google Workspace für Business/MAKE (03.10., nur lokal, Branch `google-kal`; Einrichtung: `GOOGLE_KALENDER_EINRICHTEN.md`)
Kevin 03.10.: „Wir haben nur den Kalender bei Google für MAKE und alles andere läuft über MAKE OS.“ **Business-/MAKE-Termine jeder
Person ↔ Google Kalender dieser Person, in beide Richtungen; Privat/Familie/Gemeinsam bleiben MAKE OS + iCloud.** Jeder MAKE-OS-Kalender
hat genau EIN externes Zuhause (kein Termin in zwei Quellen).
- **Allgemeine Google-Verbindung je Person** (`lib/google/verbindung.ts`, kennt keinen Kalender): OAuth 2.0 Code + PKCE (S256) + `state`
  (einmalig, 15 Min., gehört der Person der Sitzung), `access_type=offline`, `prompt=consent`, **`include_granted_scopes=true`**,
  `hd`/Domain-Prüfung (`GOOGLE_ERLAUBTE_DOMAIN`: Adresse UND `hd`-Anspruch, sonst Token sofort widerrufen). Scopes je **Funktion**
  (`GOOGLE_FUNKTIONEN`: `basis` = `openid email`, `kalender` = `calendar.events` + `calendar.readonly`) — ein weiteres Modul (z. B. Gmail) trägt
  nur seine Scopes ein und holt sein Token über `googleZugriffstoken(person, funktion)`; eine Verbindung, ein Refresh-Token. Bestände
  `google-verbindung--<person>` (Token verschlüsselt, nie im Browser/Log; `googleStatus` liefert nur maskierte Adresse + Zustände) und
  `google-oauth-zustand`. Erneuern (ein Lauf je Person), `invalid_grant` → „getrennt“ + EINE Glocke, Trennen = Widerruf bei Google + Grabstein
  (`v: 0`). Anfragen nur an `*.googleapis.com`/`accounts.google.com` (`lib/google/http.ts`: 401 → einmal erneuern, 429/403-Kontingent → `GoogleUeberlastet`
  mit Retry-After). Umgebung: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_RUECKRUF_URL` (sonst `MAKE_OS_ADRESSE` + `/api/google/rueckruf`),
  `GOOGLE_ERLAUBTE_DOMAIN` — ohne ID/Secret sichtbar aus. Setzen per `deploy/google-verbinden.sh` (fragt verdeckt, wie `icloud-verbinden.sh`).
- **Routen:** `/api/google/{status,verbinden,trennen,rueckruf}` (allgemein; **nur die eigene Person**, Dienstweg 403 — `lib/google/zugang.ts eigenePerson`),
  `/api/kalender/google` (Status, `abgleichen|voll|kalender`), `/api/kalender/google/umzug`, `POST /api/kalender/google/meldung` (Push-Webhook, ohne Sitzung).
  Middleware: genau der Webhook (POST) ist offen, und der Rückruf darf cross-site navigiert werden (`lib/zugang/cross-site.ts`, einzige Ausnahme; die Sitzung gilt weiter).
- **Spiegel = ICS-Brücke** (`lib/kalender/google/abbilden.ts`): ein Google-Ereignis (`singleEvents=false`: Serie = Master + Ausnahmen) wird zu einem
  ICS-Objekt und läuft durch denselben Kern wie iCloud (`termineAus`, ical.js: Serien, EXDATE, Zeitzonen, 25.10.-Umstellung; Einzeltermine in der doppelten
  Stunde als UTC). Dieselbe `Termin`-Form → Kalender, Heute, Wochenplan, ZOE, Bezüge, Verfügbarkeit, Spiegel, Verbindungsprüfung unverändert. Neu optional
  `Termin.link` (Meet-Link, nur https) und `KalenderEintrag.quelle/person/ich`. Bestand `kalender-google--<person>` (`stand.ts`: Ereignisse schlank, `syncToken`,
  Zustand, Kanal, `eigene` ETags); **`ladeStand()` legt die Google-Kalender über den iCloud-Stand** (`ladeStandIcloud` = nur Platte; `abgleichen`/`frischerStand`
  geben den Stand MIT Google zurück). Kalender in MAKE OS: „MAKE <Vorname> (Google)“, Kennung `google-<person>`, Schlüssel `google-<person>|uid(::RID)`,
  `calendar-cache` Kategorie `holding`; `kalender-einstellungen` trägt NIE etwas von Google — `ladeEinstellungen()`/GET legen `google` (Name → Person) zur Laufzeit dazu
  (Zuordnung `zuordnung`, Space Business, „zählt als belegt“).
- **Lesen** (`abgleich.ts`): erste Lesung ab heute − 90 Tage (`timeMin`, `showDeleted=true`), danach `syncToken`; **410 → Bestand verwerfen und sofort voll neu**;
  abgesagte Vorkommen als EXDATE (Fallback über die Instanz-Kennung); Echo: ETags eigener Schreibungen zählen nicht als „von außen“, ein Abgleich schreibt NIE nach
  Google (kein Ping-Pong); Fehler: 401 → erneuern, `invalid_grant` → getrennt, 403-Kontingent/429 → Pause (Retry-After, sonst 2 → 30 Min.), 5xx Backoff;
  `abgleichAlter` („vor X Min.“, ab 30 hervorgehoben — Kalender-Kopf, HOI-Befund `kalender-google`); Push **während** eines Laufs → ein Nachlauf.
- **Push** (`kanal.ts`): `events.watch` je Person nur mit öffentlicher HTTPS-Adresse, Kanal `mk-<person>-<24 hex>`, Token nur als SHA-256 im Bestand, Erneuerung ab 36 h
  Restlaufzeit (neuer Kanal, dann alten stoppen), Webhook prüft Kennung + Token (konstante Zeit) + Ressourcen-ID, sonst 403 leer; Fehlversuche je Netz gedrosselt, Anstoß je Person
  höchstens alle 5 s; liefert nie Daten. Ohne Push: Takt alle 5 Min. (`takt.ts`; mit Kanal 30 Min.).
- **Schreiben** (`schreiben.ts`, aus `icloud.ts anlegen/aendern/loeschen/antwortSenden` verteilt nach dem Kalender des Termins): `If-Match` mit dem ETag, 412 → `KalenderKonflikt`
  (**Google gewinnt**, „deine Fassung“ bleibt im Browser, „Meine Fassung speichern“ auf dem neuen Stand); Einladungen nur nach Klick (`EinladungNoetig` VOR dem Aufruf, `sendUpdates=all`
  nur dann, sonst `none`); eigene Kennung `extendedProperties.private.makeOsId` = UID in MAKE OS, Google-ID aus der UID abgeleitet (`eventIdFuer`, idempotent; 409 → `schonDa`; früher
  Gelöschtes wird per `PUT` wiederhergestellt); Serien anlegen ja, ändern/löschen nein; Ergebnis sofort im Bestand + `calendar-cache`.
- **Zuordnung — EINE Stelle:** `kalenderZiel(person, art)` (`lib/kalender/google/ziel.ts`; `art` = `business|privat|gemeinsam`): business → Google der Person (nur schreibbar + verbunden), sonst iCloud
  wie heute (Rückfall = heutiger Stand). Wer neue Termine schreibt, fragt nur dort: `terminAnlegenServer({ bereich })` (**Event-Spiegel** besuchter Events einer Person, **Netzwerken-Termin** im Kalender der
  zuständigen Person → business), Browser-Dialog `POST /api/kalender/termin { bereich }` (Business-Bereich der Kalenderseite → Standard Google der Person), Buchungsseite (`zielKalender` = Name, auch
  der Google-Kalender). Blöcke/Fokus/Plan, Familie und ZOE-`plan_block` bleiben iCloud. Bestehende Spiegel werden über ihre UID dort nachgezogen, wo sie liegen.
- **Umzug iCloud → Google** (`umzug.ts`): eigene Aktion, Vorschau (nichts geschrieben), dann ausdrücklicher Klick: Sicherung ZUERST (`kalender-umzug-sicherung--<person>`, 30 Tage, Takt räumt auf), je Termin
  Google anlegen (feste neue UID `makeos-um-…`), Bezug + Meetings + Follow-ups + Events/Teilnahmen/Buchungen umhängen, ERST DANN iCloud löschen; nie Gäste/Serien/Blöcke/Fokus; idempotent.
- **Recht:** Register `kalender-google--*` (ausgenommen: Löschung nur in Google, Art.-17-Lauf zählt `inGoogleZaehlen`), `google-verbindung--*` (Haushalt), `google-oauth-zustand`, `kalender-umzug-sicherung--*`;
  VVT „Kalender (Google Workspace)“ (`verarbeitungKalenderGoogle`, wird beim Öffnen von Stammdaten nachgetragen, sobald Google eingerichtet ist), AVV in der Workspace-Admin-Konsole.
- Tests: `tests/google-*.test.ts` (abbilden, verbindung, abgleich, route, webhook, ziel, umzug, lesen), Fakes in `tests/fixtures/google-fake.ts` / `icloud-fake.ts`.
  **Rückweg:** nur neue, eigene Bestände und optionale Felder — Details `GO_LIVE_CHECKLISTE.md` › „Google Kalender“.

## Gmail in der Inbox (03.10., nur lokal, Branch `gmail`; Einrichtung: `GOOGLE_GMAIL_EINRICHTEN.md`)
Kevin 03.10.: Mails ziehen von IONOS zu Gmail (Workspace, `makeinnovation.de`) — „Google ist nur die Verlängerung. Am Ende soll alles bei uns online laufen.“ Gewählt: **Lesen & zuordnen · Antworten per Klick · Aufgaben aus Mails.**
- **Andocken an die Google-Verbindung (keine zweite):** `GOOGLE_FUNKTIONEN.gmail` = NUR `gmail.modify` (lesen, markieren/archivieren, senden, `history`/`watch`/`sendAs`; kein `mail.google.com/` und kein überflüssiges `gmail.send`; kann nicht endgültig löschen). Inkrementell: `verbindungStarten(person, ['gmail'])` ergänzt (`include_granted_scopes`, `login_hint`), `angefordert` im Zustand → der Rückruf richtet NUR das neu Angeforderte ein (ein Gmail-Zusatz setzt den gewählten Kalender nie zurück) und führt nur-Gmail zurück nach `/os/inbox?google=…`. Host `gmail.googleapis.com` steht in `GOOGLE_HOSTS`. Knopf „Gmail verbinden“ in der Inbox (`components/os/inbox/GmailVerbinden.tsx`), Hinweis + Link in den Kalender-Einstellungen. Trennen räumt auf (`lib/google/trennen.ts`: `users.stop` + Spiegel weg), `gmailAusschalten` nur Gmail.
- **Spiegel je Person** (`lib/gmail/*`): Bestände `gmail-stand--<person>` (Köpfe: Von/An/Cc/Betreff/Datum/Message-ID/Thread/Labels, Ausschnitt, Anhang-Metadaten, Zustand, `historyId`, Aliase) und `gmail-text--<person>` (Textkörper; `adressen` je Eintrag für Art. 15/17). Erstabgleich 30 Tage Posteingang + Gesendet (Zähler VOR dem Lesen), danach `history.list`; **404 → Spiegel verwerfen, sofort voll neu**; nur INBOX/SENT (nie DRAFT/SPAM/TRASH), schon Gespiegeltes bleibt beim Archivieren. Takt (`lib/gmail/takt.ts`, im `/api/zoe/takt`): alle 2 Min., mit Push alle 15; Fehler wie beim Kalender (401 erneuern, 429/Retry-After, `invalid_grant` → „getrennt“ + EINE Glocke über den Kalender-Weg). Aufbewahrung: Frist **`mail-spiegel` 180 Tage** (30–730; `loeschfristen.ts`, Lauf-Schritt 11b `gmailAufraeumen`) + höchstens 1500 Nachrichten. **Nie im Spiegel:** Anhang-Inhalte, HTML, Bilder.
- **Echtzeit optional** (`lib/gmail/meldung.ts`, `POST /api/google/gmail/meldung`, ohne Sitzung — Middleware nur für diesen Pfad): `users.watch` auf Pub/Sub, Push mit **OIDC-Token von Google** (RS256 gegen die öffentlichen Schlüssel, `iss`, `aud` = `GMAIL_PUSH_AUDIENCE`/Webhook-Adresse, `email` = `GMAIL_PUSH_DIENSTKONTO`, `exp`); ohne Einrichtung IMMER 403, Fehlversuche je Netz gedrosselt, ein Anstoß je Person alle 5 s, nie Daten. Umgebung `GMAIL_PUBSUB_THEMA`, `GMAIL_PUSH_DIENSTKONTO`, `GMAIL_PUSH_AUDIENCE` (`deploy/google-verbinden.sh` fragt optional).
- **Nie fremd lesbar / nie automatisch senden:** alle Routen (`/api/gmail`, `/nachricht`, `/anhang`, `/senden`, `/entwurf`) nur über `eigenePerson` (Sitzung, Haushalt; **Dienstweg 403**, ZOE/Takt/Skripte können weder lesen noch senden; Malin liest nie Kevins Mails, der Spiegel trägt die Person im Namen). Senden: `anfrageId` + `einmalig`, Absender nur eigene Adresse/verifizierter „Senden als“-Alias, Antwort im Thread (`threadId`, `In-Reply-To`, `References`, `Re:`), Empfänger geprüft (kein Zeilenumbruch, ≤ 20), **Art. 18 → 409**, **§ 7 UWG:** werbliche Wörter (`werbeWoerter`) + rote Mail-Ampel/Werbesperre → Rückfrage 409 `uwg`, die Person entscheidet. Gesendete Mail sofort im Spiegel + Verlauf. Kein Mailtext in Protokollen (`protokolliere('gmail', …)` nur Kennung).
- **MIME/HTML (`mime.ts`, `html.ts`, ohne Paket):** Nachrichtenbaum (`format=full`) → Kopf + Text (text/plain bevorzugt), Zeichensätze (UTF-8, Latin-1, **Windows-1252 selbst gelesen** — Node-TextDecoder liefert 0x80–0x9F falsch), RFC 2047, Quoted-Printable; Senden: UTF-8-QP, Header ohne Umbrüche. **HTML wird nie gerendert:** nur Text (Skripte/Styles/Frames weg, Bilder nie geladen und gezählt, Links `Text (echte Adresse)`, nur http(s)/mailto, Tracking-Parameter weg); die Oberfläche macht nur `http(s)`-Adressen anklickbar (`rel="noopener noreferrer nofollow"`). Anhänge nur als Download auf Klick (`application/octet-stream`, `attachment`, `nosniff`, `sandbox`, ≤ 25 MB, frisch aus Gmail).
- **Zuordnung & Verlauf (`zuordnung.ts`):** Absender/Empfänger → Kontakt über ALLE Adressen (`alleAdressen`; Sammeladressen nie) → Firma/offener Deal, mit Mail-Ampel; **Anzeige auch für eingeschränkte/gesperrte Personen (gekennzeichnet), Verlauf nur über `kontakteFuerVerarbeitung` + `ausgenommen`.** Verlauf der Kontaktakte: je Mail EINE Zeile (`antwort` = vorhandenes Wärme-Signal, gesendet `mail`) mit Betreff + `Aktivitaet.mailLink` (`/os/inbox?offen=gmail-<id>`, gesäubert in `saeubereKontakt`; eine Zeile in `aktivitaeten-teile.tsx`), idempotent über `bezugMail`. Unbekannter Absender: „Kontakt anlegen“ = `/api/crm/anfrage` (Kanal Mail → Herkunft „selbst“, Vertrag/Anbahnung, „Antwort auf Anfrage“, zählt als Marketing-Lead über „Anfrage über …“).
- **Inbox-Oberfläche:** Gmail als Quelle in `InboxSchlank.tsx` (Quelle filterbar), Liste = Threads (`lib/gmail/liste.ts`), Einstufung **ohne Modell** (Gmail-Kategorien/Listen = Rauschen, zugeordnet/markiert = Wichtig — Gmail geht nie in die gemeinsame ZOE-Einstufung `inbox-triage`), `GmailDetail` (Thread, „gehört zu …“, Antworten/Allen antworten, Aufgabe, Follow-up, Termin über `NeuerTermin` mit `kalenderZiel` Business → Google, Kontakt anlegen, Gelesen/Archivieren → Label INBOX weg), `GmailAntwort` (Editor, Alias-Wahl, **ZOE-Entwurf** = `lib/gmail/entwurf.ts`: Brain-Kontext ohne 🔒-Privates, Anrede Du/Sie, Fremdtext als `fremd()`, nie bei Art. 18). `Vorgabe.notiz` neu (vorbelegte Termin-Notiz).
- **Recht:** Register `gmail-stand--*`/`gmail-text--*` (entfernen, Frist Mail-Spiegel; Art. 15/17 über `mapEintraegeRaus`, die Antwort des Löschlaufs zählt „dort in Gmail löschen“ über `nurInApple`), VVT „E-Mail (Google Workspace)“ (`verarbeitungEmailNachtragen`), HOI-Befund `gmail`. Tests: `tests/gmail-*.test.ts` (mime, abgleich, zuordnung, route, webhook, verbinden), Fake `tests/fixtures/gmail-fake.ts`. **Rückweg:** nur neue Bestände + optionale Felder (`Aktivitaet.mailLink`, Frist `mail-spiegel`) — Details `GO_LIVE_CHECKLISTE.md` › „Gmail in der Inbox“.
- **Offen/Befund:** `/api/oauth/callback` (Whoop/M365) wird von der Cross-Site-Regel (`middleware` → `crossSiteVerboten`) bei einer Navigation vom Anbieter blockiert — siehe Bericht; nicht geändert.

## Brain (lib/brain, seit 27.09.)
- Wahrheit ist der Vault (Markdown, Obsidian). Der Index (`lib/brain/index.ts`, SQLite FTS5 + Vektoren) ist abgeleitet — bei Zweifel Datei löschen, der Takt baut neu.
- Suche immer über `suche()` in `lib/zoe/vault.ts` (nimmt den Index, sonst Dateisuche). Sicht (`darfSehen`) gilt VOR dem Ranking — nie nachträglich filtern.
- ZOE schreibt ins Brain nur über `lib/brain/inbox.ts vorschlagAblegen` (plus Zoe_Log). Menschen: Regeln (`lib/brain/regeln.ts`) und Freigaben. Nie Notizen überschreiben.
- Regeln (`00. Fundament/Regeln`) und Konstitution sind ANWEISUNGEN an ZOE — nur `status: aktiv` mit `freigegeben_von` einer BEKANNTEN Person (Konten) wird geladen (`regelnFuerPrompt` → `regelFreigegeben`, 29.09. D-B #100). Ein Kopf, den `leseKopf` nicht sicher versteht (verschachtelt, Blocktext `|`/`>`), liefert `warnungen` — solche Regeln werden nie geladen; mehrzeilige Listen (`key:` + `  - a`) liest er. Alles andere aus dem Vault bleibt Daten (`fremd()`).
- **Sicht symmetrisch (29.09., D-B #92):** `scope: privat` sieht NUR die Eigentümerin/der Eigentümer (`owner`, ohne Angabe kevin) — auch Kevin nicht Malins private Notizen. Am Mac liest die App den Vault zuerst unter `~/Vaults/MAKE/Make.Claude` (VAULT_UMZUG_ANLEITUNG.md), sonst auf dem Schreibtisch. Brain-Index mit `PRAGMA secure_delete=ON`.
- Lokal NIE in Kevins echten Vault schreiben; Tests setzen `MAKE_VAULT_DIR` auf einen Temp-Ordner und `MAKE_OS_DOKU_WURZEL=aus`. Embeddings sind im Test aus.
- **Server-Vault ist die Wahrheit (Kevin 29.09., `BRAIN_SERVER_PLAN.md`):** drei Bereiche — eure Notizen (nur Menschen), `_App/` (generiert),
  `_inbox/` (Vorschläge von ZOE: Konsolidierung, Regeln, Erkenntnisse, App-Tagesbericht). Die App schreibt NUR in einen konfigurierten Vault
  (`lib/brain/vault-ziel.ts` `vaultZiel`: `MAKE_VAULT_DIR`, auf dem Server `/vault`; Schreibtisch/iCloud/`~/Vaults`/`~/Documents` auf dem Mac werden
  abgelehnt, auch per Symlink) — ohne Ziel nichts, Grund im Log. Tests: Temp-Ordner.
- **App → Brain-Brücke (29.09., S2/B2):** Leitplanken an EINER Stelle `lib/brain/app-material.ts` (`aufgabeSichtbar`, `nurIch` — liest das kommende
  Feld „nur ich“ tolerant, `imPapierkorb` — `geloeschtAm` tolerant): nichts an Art.-18-Kontakten (nur „n ausgeblendet“), keine Kontakt-Notizen/-Daten,
  keine IBAN, nur Titel/Status/Links; Privat-Space nach Einstellung `brain-bruecke--<haushalt>` (`privat: 'anzahl'` Standard = nur Zahlen · `'voll'`),
  Route `/api/brain/app` (GET Stand · POST `{ privat }` · POST `{ aktion: 'jetzt' }`). Texte über `md()`/`zitat()` (keine Wikilinks/HTML aus Daten).
  - **App-Tagesbericht** (`lib/brain/app-bericht.ts`): je Tag EIN Vorschlag „App-Tagesbericht JJJJ-MM-TT“ in `_inbox/zoe` (erledigte Aufgaben je Projekt,
    Projekt-Notizen Titel + Kurzfassung, Angebote, Deal-Stufen, Mandate neu/beendet, ZOE-Entscheidungen, Zeit je Mandat der Woche) — ohne Modell,
    idempotent auch nach Annehmen/Ablehnen (`vorschlagAblegen(…, { tag, einmalig })`), nichts an leeren Tagen, > 7.900 Zeichen sichtbar gekürzt.
  - **`_App/`-Spiegel** (`lib/brain/app-spiegel.ts`, direkt geschrieben, nur mit `MAKE_OS_APP_SPIEGEL=an` — einschalten erst auf Kevins Wort):
    `Projekte/<Space>/<Projekt>.md` (Beschreibung, Notiz, offene/erledigte Aufgaben mit Links; Privat standardmäßig nur `Projekte/Privat.md` mit Zahlen),
    `Mandate/<Firma>.md` (Mandate, Aufgaben, Zeit dieser/voriger Monat, Angebote), `Angebote.md`, `Entscheidungen/<JJJJ-MM>.md`, `Woche/<JJJJ>-KW<NN>.md`.
    Kopf `type: app-spiegel` + „Automatisch aus MAKE OS — nicht von Hand bearbeiten.“ Nur bei Änderung (atomar), Dateien ohne diesen Kopf werden nie
    überschrieben, verwaiste Spiegel unter Projekte/ und Mandate/ fallen weg, Entscheidungen/Wochen bleiben. Läufe: nächtlich in `konsolidieren`
    (erzwungen, mit dem Tagesbericht), im Takt über `indexFrischHalten` (Riegel `brain-app-spiegel` = Tag + Stand von tasks/crm/kontakte/Entscheidungen),
    nach ZOE-Entscheidungen gebündelt (`spiegelAnstossen`, 1 Min.). `_App` ist aus dem Vault-Index ausgenommen (`AUSGESCHLOSSEN` in lib/zoe/vault.ts).
- **Such-Index der Arbeitsbestände `app_chunks` (29.09., B3, `lib/brain/app-index.ts`):** dieselbe SQLite wie der Brain-Index, eigene Tabelle + FTS5
  (Aufgaben Titel/Beschreibung/Notiz, Kommentare je Zeile, Projekte Titel/Beschreibung/Notiz, Angebote Titel/Einleitung, Mandate). Jede Zeile trägt
  `haushalt` + `privat`; die Sicht steht IN der Abfrage (`appSuche`), nie nachträglich filtern. Papierkorb, „nur ich“, Art.-18-Bezug gar nicht im Index.
  Abgeleitet: `appIndexNeuBauen()` (auch POST `/api/brain/index { aktion: 'arbeit' }`), inkrementell `appIndexAktualisieren()` je Zeilen-Hash — vor jeder
  Suche, wenn sich tasks/crm/kontakte geändert haben (`speicherStand`), und im Takt. Embeddings bewusst nicht (optional).
  **Eine Suche für ZOE:** `suche_arbeit` (`lib/zoe/arbeit-werkzeug.ts`, frei, LESEND, SELBST_GEKAPSELT) fragt Vault (`suche`, Sicht der Person) und
  `app_chunks` und mischt nach Rang; Kopfzeile nur Zahlen, Treffer im `fremd()`-Block mit Links (`WEG.aufgabe`, Projektseite, `WEG.angebot`, `WEG.mandat`).
- **ZOE-Entscheidungen dauerhaft (29.09., B1, `lib/zoe/entscheidungen.ts`):** jede Stapel-Entscheidung (freigegeben · abgelehnt · fehlgeschlagen ·
  zurück an ZOE) mit Person (`entschiedenVon`), Art, Bezug (Kontakt-Kennungen als Fingerabdruck), Grund (eigener Text der Person) und jede Werkzeug-Ausführung
  (nur Feldnamen) gehen in derselben Sperre nach `zoe-entscheidungen--<haushalt>--<JJJJ-MM>` — nur anhängend wie das Änderungsprotokoll. `zoe-stapel`
  (200 Erledigte) und `zoe-protokoll` (500) kürzen nur Festgehaltenes (`protokolliert`/`dauerhaft`), Altbestand wird vorher nachgetragen, scheitert das,
  bleibt er stehen. Freigeben beansprucht zuerst in der Sperre (`beanspruche` → Status `in_arbeit`, verwaist nach 10 Min.), dann ausführen, dann
  `entscheide(…, { von, ausArbeit: true })`, bei Fehler `loslassen`; `entscheide` entscheidet nur Offenes (sonst `null` → 409). CRM-Arten ohne Stand sind
  zusätzlich idempotent über die Vorschlags-Kennung (Aktivität `vorschlagId`, Follow-up `fu-<v-…>`, Beitrag `b-…`, Newsletter `nl-…`, Segment `seg-…`,
  Gäste `tn-…-i`). Grund > 400 Zeichen bzw. „Ändern & freigeben“ über den Grenzen → 413 mit Grund, nie gekürzt. Test `tests/zoe-entscheidungen.test.ts`.
- `gatherBrain` (lib/brain.ts) liest Aufgaben über `ladeAufgaben` → `aufgabenFuerBrain` (nur Hauptaufgaben, ohne Papierkorb), nur für Personen im
  Haushalt des Inhabers; `mandate_lage` zeigt die Zeit je Mandat der Woche (`lib/zeitmessung/mandate-server.ts`). Test `tests/brain-app-bruecke.test.ts`.

## Datenschicht (lib/store/local-db.ts, Stufe 1 seit 27.09.)
- `loadJson` gibt nur bei „Datei fehlt“ null; Lesefehler werfen `BestandNichtLesbar`, ein beschädigter Bestand blockiert Schreibungen (`BestandBeschaedigt`). Nie `catch → null` um loadJson legen, wenn danach geschrieben wird.
- `updateJson`/`saveJson` schreiben nicht, wenn der Stand unverändert ist — Zeitstempel als „Beweis für einen Lauf“ gehören in den Inhalt, nicht in die Dateizeit.
- Neue Bestände, die ständig geschrieben werden, aber in keinen Index eingehen, in `RAUSCHEN` (lib/store/memo.ts) eintragen — sonst leeren sie den Zwischenspeicher.
- **Nie abschneiden, ablehnen (28.09.):** Säuberungen kürzen keine Listen (kein `.slice(0, n)` über Bestand, auch nicht beim Lesen) — wer über eine Grenze wachsen will, bekommt 4xx mit Text (413). Grenzen des Finanzplans: `GRENZEN` in `lib/finanzen/finanzplan-bestand.ts`, auch für ZOE und Beleg-Übernahme.
- **Ausstehende Änderungen nie verwerfen; Build-Kennung; Papierkorb (29.09., Kevin: „Alle Infos müssen immer sauber gespeichert werden — extrem wichtig“):**
  - **Aufgaben im Browser** (`context/TasksContext.tsx`, Regeln rein in `lib/aufgaben/abgleich.ts`): ausstehend = Sicht minus zuletzt BESTÄTIGTER Serverstand — erst die Antwort des Servers hakt ab, nie das Absenden. Netz/5xx/429/401 → erneut mit Backoff (2 s … 60 s), 400/413/Kreis → Paket in Einzeländerungen zerlegen, nur die schuldige Zeile bleibt mit Grund stehen (Eingabe bleibt), 409 → nur die Konflikt-Zeile nimmt den Serverstand, die eigene bleibt als „Deine Fassung“ (übernehmen/kopieren), der Rest geht sofort erneut. Abgleich (45 s/Fokus) legt Ausstehendes WIEDER auf den neuen Serverstand (`ABGLEICH`, alter Stand je Zeile → fremde Änderung = Konflikt statt still überschrieben). Serverstand + Sicht nur gemeinsam ändern (`gemeinsam`). Ausstehendes liegt im Sitzungsspeicher (`make-aufgaben-ausstehend`) und geht nach Neuladen mit altem Stand erneut raus; `pagehide`/`visibilitychange` → sofort (keepalive), `beforeunload` warnt. Sichtbar global über `components/os/aufgaben/SpeicherHinweis.tsx` (im Provider, gilt auch für CRM-Kachel, Flächen, Heute).
  - **Build-Kennung** (`lib/bau/kennung.ts`, `lib/bau/pruefen.ts`, `next.config.mjs` → `NEXT_PUBLIC_MAKE_BAU`): die Fetch-Hülle (`components/os/BauWache.tsx`, Wurzel-Rahmen) setzt `x-make-bau` an jede schreibende Anfrage an /api; geschützte Routen rufen nach der Zugangsprüfung `bauPruefen(req)` → fremde/fehlende Kennung 409 `{ neuLaden: true }` + `NEU_LADEN_TEXT` (für alte Tabs: verspricht nichts, „Eingabe nicht gespeichert“; neue Tabs zeigen `NEU_LADEN_HINWEIS`) (Dienstweg ausgenommen, ohne Kennung — Tests — keine Prüfung). Heute: `/api/state/tasks`, `/api/tasks/create`, `/api/aufgaben/{zoe,dateien}`, `/api/crm/{bestand,angebot,gesellschaften}`, `/api/gesellschaften` (+ `/unterlagen`), `/api/state/kontakte`. Neue schreibende Routen auf geteilten Beständen: dazunehmen.
  - **Aufgaben-Server:** Upsert OHNE Stand über einen bestehenden Eintrag = Teil-Merge (`teilMerge`: nur mitgekommene Felder, `null`/'' leert). PUT nur beim leeren Erststart (sonst 409 `neuLaden`). Lösch-Kennung > 80 → 400. Feldwerte: nur NEU gesetzte prüfen (`feldWerteTypisieren(…, alt)`), umbenannte Auswahl-Werte (gleiche Stelle, `auswahlUmbenennungen`) zieht der Schreibweg an allen Aufgaben mit; Beträge über `euroAlsCent` („1.500“ = 1.500 €).
  - **Papierkorb** (`lib/aufgaben/papierkorb.ts`): Löschen = `geloeschtAm` (Projekt samt Aufgaben `geloeschtMit` = Projekt, Aufgabe samt Unteraufgaben); Notiz/Felder/Listen/Dateien bleiben. Wiederherstellen samt Kette; `delete` auf einen Papierkorb-Eintrag ist endgültig (dann `papierkorbDateienEntfernen`), 30 Tage → Morgenlauf `papierkorbAufraeumen`. UI: Aufgaben › Archiv › Papierkorb, Rückfrage nennt den Umfang. **Leser nie roh:** Server `ladeAufgabenSicht` (lib/aufgaben/sicht.ts, übernommen, ohne Papierkorb), GET `/api/state/tasks` ohne `?papierkorb=1`, Browser `useTasks().state` (der volle Stand heißt `voll`). Ausnahmen mit Grund: Art. 15/17, Verbindungsprüfung, Server-Schreiber in der Sperre. Seit 29.09. (T1) mit Person: `ladeAufgabenSicht(person)` (Sichtfilter „nur ich“), Brain/Index/Spiegel in der Systemsicht.
  - **Übernahme** (`lib/aufgaben/umbau.ts`): Schreiber des übernommenen Stands gehen über `aufgabenSchreiben` — vor dem ersten Schreiben EINMAL `archiv/tasks-vor-umbau-<zeit>.json`, danach Merker `umbauVersion`.
  - **Notiz/Beschreibung** (`components/os/aufgaben/useEntwurf.ts`): Autosave nach Pause, `onBlur`, beim Verlassen; Entwurf je Feld im Sitzungsspeicher bis der Server bestätigt; über der Grenze sichtbar „nicht gespeichert“, nie gekürzt. Angebots-Editor: 409 behält „Deine Fassung“, Fehler → Timer, Verlassen → keepalive.
  - **Laufender Fokus** liegt serverseitig je Person (`fokus-laufend--<person>`, `/api/state/fokus`, `fokusAbgleichen`); der Block wird erst gelöscht, wenn `/api/state/zeit` ihn gespeichert hat.
- **Geteilte Listen nur per Einzeländerung mit Stand (28.09.):** Ziele, Meilensteine, Routinen, Blöcke, Aufgaben — nie die ganze Liste zurückschreiben. Browser: `ListenSchreiber` (`lib/make-one/liste-stand.ts`: Absicht je Kennung, Stand aus dem letzten Serverstand, Senden nacheinander, Sicht = Server + Offenes); Server: `listePatchen` (GET liefert `mitStand`, 409 mit aktuellem Bestand). Folgeschritte wie die Ziel-Kaskade über `danach` in derselben Sperre. Zwei Bestände in einer Sperre: `updateJsonAsync` (außen), innen `updateJson` eines ANDEREN Bestands.
- **Meldungen / Glocke (28.09. abends, B2):** melden nur über `melde()` (`lib/meldungen/melden.ts`, wirft nie, nie an `von` selbst, nur an Personen im Haushalt des Inhabers). Speicher `meldungen--<person>` (`lib/meldungen/speicher.ts`), Regeln rein in `lib/meldungen/regeln.ts`: je Art + Bezug eine ungelesene (neuere ersetzt), Grenze 500 — erst älteste gelesene weg, dann älteste ungelesene zu „+N weitere“ zusammenfassen, nie still löschen. Fällig/überfällig nie speichern, beim Lesen aus `tasks` ableiten (Berliner Tag, Merker je Tag). Route `/api/meldungen` (GET ETag, POST `gelesen`/`einstellungen`, nur eigene, Dienstweg ohne Person 403). Glocke `components/os/Glocke.tsx` im Kopf: Abfrage beim Laden, bei Fokus und alle 60 s nur sichtbar. Telegram: Einstellung `telegram` (aus), versendet wird erst in `telegramHaken` — heute nichts.
- **Rechnungen ab „gestellt“ (28.09., K3):** nie löschen, Betrag/Nummer/Datum/Netto/USt-Satz nie ändern (Nachtragen leer → Wert erlaubt), kein Zurück im Status — stattdessen `PATCH /api/state/finanzplan { aktion: 'storno', rechnungId, grund, stand? }` (Status `storniert` + `storniertAm`/`stornoGrund`; Gegenbuchung `bu-st-<id>` zum Eingang `bu-re-<id>`, in derselben Sperre). Regel an EINER Stelle: `rechnungSchutz` in `lib/finanzen/finanzplan-bestand.ts` (Route PATCH/PUT und ZOE). Wer Rechnungen zählt: `storniert` ist weder offen noch Umsatz — nie „alles außer bezahlt“ als offen nehmen. Dateiablage: Einträge mit `rechnungId`/`mandatId` (`istBeleg`) nicht löschbar (409), nur vom Bezug lösen.
- **Finanzplan-Listen mit Stand (28.09., K3):** GET liefert je Eintrag `fassung` (nicht `stand` — `Firma.stand` ist das Kontostand-Datum); ops tragen `stand` oder `eintrag.fassung`, veraltet → 409 mit `konflikte[]` + ganzem Stand. Seiten mit `useSpeichern` übergeben `standFeld: 'fassung'` (Stand kommt aus dem letzten Serverstand, Speichern läuft nacheinander).
- **Geld auf den Cent (28.09., K3):** Beträge `Math.round(x*100)/100`, nie auf ganze Euro; `Rechnung.betrag` ist brutto in €. Brutto/Netto/USt nur über `lib/finanzen/ust.ts` (kaufmännisch je Rechnung) — keine eigenen `/ 1.19` oder `* (1 + satz/100)`. Der Rechenkern rechnet weiter mit Euro-Dezimalzahlen (echte Cent-Ganzzahlen dort entscheidet Kevin; die vier Punkte des Kern-Umbaus 02.10. haben das nicht geändert).
- **„Heute“ = `localDay()`, Tag eines Zeitstempels = `tagVon(iso)` (28.09., K3):** nie `new Date().toISOString().slice(0, 10)` oder `jetzt.slice(0, 10)` — das ist der UTC-Tag (nachts bis 2 Uhr gestern). `leads()` verlangt `heute`. Wächter in `tests/repo-sauber.test.ts` (Ausnahmen mit Grund). Monatsfristen „+1 Monat“ kappen am Monatsende.
- Kontakte im Browser: `api.kontaktTeil(id, felder)` statt ganzer Kontakt; jede Zeile trägt `stand` (Fingerabdruck), der Server antwortet 409 bei Konflikt — nie `stand` selbst setzen oder speichern. `listePatchen` prüft in der Sperre (`pruefen`), Konflikte kommen als `konflikte[]`.
- **Felder leeren = `null` (28.09., F1):** JSON verwirft `undefined`. Kontakte: `kontaktTeil` übersetzt `undefined` → `null` (`leerAlsNull`), der Server entfernt das Feld (`teilAnwenden`, nie `id`/`stufe`/`aktivitaeten`/`zahlung` …). CRM-Bestand: `api.teil(liste, id, nurFelder(teil))` (`undefined` → `''`, die Säuberer lassen es weg). Nie `{ ...eintrag, ...teil }` als ganzen Eintrag aus dem Browser-Stand schreiben.
- **Firmen-Upsert führt zusammen (28.09., F1):** `firmenId` kommt aus dem Namen ohne Rechtsform — vor dem Anlegen `bestehendeFirma(firmen, name)` fragen und verknüpfen. Serverseitig (`wendeCrmAn` → `firmaZusammenfuehren`) füllt ein Upsert mit bestehender Kennung nur leere Felder; ändern nur über `teil`.
- **Firmen-Kennungen am Ergebnis nachziehen (29.09., Sichtprüfung F1):** `crmSchreiben` wendet `firmaIdsNachziehen` (lib/crm/firmen-bezug.ts) auf das ERGEBNIS jeder Änderung an — gespeicherter Stand = gelesener Stand (`ladeCrm`), sonst 409 bei der nächsten Änderung. Anzeigename (Mandat `kunde`, Deal `firma`) geändert ohne neue Kennung → Kennung neu auflösen (eindeutiger Treffer) bzw. entfernen. Kleine Formulare mit eigenem Stand (z. B. Gesellschaften) schreiben über eine Kette (`gesellschaftKette`, lib/crm/gesellschaft-kette.ts): nacheinander, Stand aus der letzten Antwort, Meldung erst beim nächsten Schreiben weg, Ungespeichertes sichtbar.

- **Datenschicht-Kern (29.09., Paket D-A):**
  - Dateien, die nicht über local-db gehen (Archiv, Skripte, Dateiablage), schreiben NUR über `atomarSchreiben(pfad, bytes)`
    aus `lib/store/atomar.mjs` (tmp → fsync → rename → Ordner-fsync) — nie `writeFile`/`copyFile` direkt auf den Zielnamen.
  - Sperren: nie denselben Bestand in seiner eigenen Änderung erneut sperren (`SperreFalsch`), Rangfolge `crm` → `kontakte`
    wird geprüft, 30 s Zeitlimit (`SperreZeitlimit`, 503). Nur Dateien NEBEN einem Bestand unter dessen Sperre: `mitBestandSperre`.
  - Neue Kennungen nur über `neueKennung(praefix)` (`lib/kennung.ts`, `<präfix>-<uuid>`) — nie `Date.now()` (Wächter
    `tests/kennungen.test.ts`). Kennungen tragen keine Zeit; sortieren nach dem Zeitfeld.
  - `_v` ist ein reservierter Schlüssel (Schemaversion, schreibt local-db nur im Format v2 — im Kompatibilitätsmodus nie,
    Leser sehen ihn nie). Formänderung eines Bestands = Eintrag in `lib/store/schema.ts` (Version hoch, Migration rein und
    idempotent, mit Test) — im Kompatibilitätsmodus läuft sie bei jedem Lesen (kein `_v`) und bricht den Rückweg für diesen
    Bestand (der alte Stand kennt die neue Form nicht): Formänderungen erst nach der Umstellung auf v2.
  - Skripte, die in `.data` schreiben, rufen `skriptSperreOderAbbruch(ordner)` (`lib/store/schreiber.mjs`) — die App hält
    `.schreiber` mit Herzschlag. Neue Dienstwege der Datenschicht liegen unter `/api/intern/*` (nur Dienstweg bzw. Inhaber).
  - Wiederholbare Wirkungen aus dem Browser (anlegen, buchen) nehmen eine `anfrageId` und laufen über `einmalig()`
    (`lib/store/anfragen.ts`). Teure Arbeit (PDF, KI, Netz) nie in einer Schreibsperre: reservieren → außerhalb rechnen →
    mit Stand-Prüfung festschreiben (Vorbild `angebotStellen`).
  - Neues Feld in einem CRM-Typ → auch in den Säuberer (Wächter `tests/crm-saeuberer-waechter.test.ts`).
  - Betrieb: Nachtsicherung, Mac-Abholung, Einzel-Restore, Durchsicht und Rotation stehen in DEPLOY.md und NOTFALL.md;
    der HOI zeigt Sicherung/Abholung/Durchsicht/Sperr-Messwerte. „Heute“ ist der Berliner Tag (`localDay` über Intl).
- **Absichtsprotokoll & Kennungen (29.09., Paket D-C #17/#21/#33/#35):**
  - Ein Vorgang, der NACHEINANDER mehrere Bestände schreibt, legt VOR dem ersten Schreiben eine Absicht an
    (`absichtBeginnen` in `lib/store/absichten.ts`, Bestand `absichten--<haushalt>`: Art, Schlüssel, Daten, die die Schritte
    brauchen, Schrittliste) und läuft über `mitVorgang(h, absicht, v => v.schritt(name, fn))` — jeder Schritt idempotent,
    abgehakt nach der Wirkung, Abschluss `absichtAbschliessen` (leert Daten und Schlüssel; `behalten` nur ohne Personenbezug).
    Neue Art = Eintrag in `ABSICHT_ARTEN` + Fortsetzer in `lib/store/absichten-fortsetzen.ts` + Test „Abbruch nach jedem
    Schritt“ (`absichtTest.vorAbhaken/nachAbhaken/vorSchritt`). Wiederaufnahme: Start (`betrieb.ts`), Takt (Agent `absichten`),
    Durchsicht; 3 Fehlversuche → „gescheitert“ (HOI rot, `POST /api/intern/absichten { aktion: 'erneut', id }`).
    Heute: Art. 17 (`personEntfernen`, Kartei-Löschen merkt vor: `art17Vormerken`/`art17Verwerfen`), Dubletten, Import
    (`importNachlauf`), CRM-Folgen gelöschter Deals (`crmSchreiben`), Angebot stellen, Kennungs-Umzug/Rückweg.
  - Art. 17 meldet je Schritt ok/fehler (`schritte`, `vollstaendig`); ein scheiternder Bestand hält die anderen nicht auf,
    das Löschprotokoll trägt `status` (`laeuft`/`vollstaendig`/`unvollstaendig` + `fehlend`) — nie 500 ohne Aufschlüsselung.
  - Neue Kontakte NUR mit `neueKontaktKennung()` (`c-<uuid>`, `lib/kennung.ts`) — nie aus E-Mail/Name. Wiedererkennung über
    `schluessel` (Index), nicht über die Kennung. Altbestand: Kennungs-Umzug (`lib/crm/kennungen-umzug.ts`, Route
    `/api/crm/kennungen-umzug` nur Inhaber, Karte Stammdaten › Datenqualität, **nie automatisch**) über `personenUmbiegen`
    (viele Paare, je Bestand EINE Sperre; `umzug: true` zieht auch Läufe, übrige Bestände und Protokoll-Fingerabdrücke um).
    Weiterleitung alter Kennungen: `kennung-alias--<haushalt>` (`lib/crm/kennung-alias.ts`, `app/os/markttraktion/page.tsx`).
    Wer Kontakt-Kennungen in einem NEUEN Bestand hält: Umzug erfasst ihn über die Tokenersetzung automatisch — außer er
    steht in `UMZUG_EIGENE` (person-bestaende.ts).
  - Dateiablage schreibt im Format des Modus (kompatibel „MKOSDAT1“, v2 „MKOSDAT2“ mit Schlüssel-ID + AAD Haushalt/Kennung,
    `lib/store/datei-huelle.mjs` `binImModus`), liest v1 + v2 über den Schlüsselring; Kennungen `d-<uuid>`.

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

- **Fokus-Signatur + Strahl v3 (04.10., Kevin: „Diese Akzente überall, wo Fokus ist — dezent, aber immer wichtig; der Strahl läuft von links nach rechts“):**
  `Karte ton="fokus"` (gläsern, Lichtfaden an der Kante, `licht`, `netz`), `FadenLinie` (Mini-Strahl über EINER echten Reihe, `reihe` + `label` Pflicht,
  Reihen rein in `lib/lichtfaeden/reihen.ts`, Zeichner `lib/lichtfaeden/fadenlinie.ts`), `Segmentbalken`. Höchstens eine Fokus-Karte und zwei FadenLinien je
  Ansicht, nie ohne Daten, reduzierte Bewegung = still (DESIGN_STANDARD.md › Fokus-Signatur, Wächter `tests/fokus-signatur.test.ts`). Strahl v3 (band/zeichnen/
  faedenband): fließt nach rechts, Aufbau von links, Ausfransen nach HEUTE, Spitzen aus `Buendel.spitze`, Partikel, Glühen — Website-Zeichner neu erzeugen.

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
- **Kontakt öffnen (28.09., H1, nur lokal — ersetzt „Akte öffnen“ in der Oberfläche):** Wort ist überall „Kontakt öffnen“/„Kontakt“ (Deal-Akte bleibt Deal-Akte); Adresse bleibt `a=akte`. Kopf wie gehabt, darunter drei Spalten ab `SPALTEN_AB` (sonst links · Reiter · rechts untereinander): links `KontaktLinks` (Kontaktdaten, Schnellaktionen Notiz · E-Mail · Anruf · Aufgabe · Meeting — nur über `/api/crm/aktivitaet`, `/api/crm/followup`, `EntwurfTeil` + `mailto:`/`tel:` bei nicht roter Ampel, **nie Versand**; „Meeting“ legt seit K3 einen echten Termin an — `MeetingNeu` = Anlege-Dialog des Kalenders, vorbelegt mit Person/Firma), rechts `KontaktRechts` (Firma via `firmaVerknuepfen`, Deals via `DealAnlegen`, aktive Mandate, offene Follow-ups aus `faellige`), beide in `KontaktSpalten.tsx`; Karten über `Klappe`/`useKlappen` (`kontakt-klappe.tsx`, Merker `mt-akte-zu-<id>`). Reiter `AKTE_REITER` = `ueber | aktivitaeten | umsatz | daten` (`akteReiter` übersetzt ueberblick→ueber, verlauf→aktivitaeten, stammdaten/beziehung/datenschutz→daten; `u=` nur bei Aktivitäten über `akteUnter`; `kontaktAkte(id, t, u)`). Über = `KontaktUeber.tsx`: Zusammenfassung rein aus `lib/crm/zusammenfassung.ts` (Sätze mit Quellen ①②, Anker aus `ankerListe` → `t=aktivitaeten&u=alle#akt-…`), „Frage stellen“/„Mit ZOE formulieren“ über `app/api/crm/kontakt-frage` (GET = KI verfügbar?, POST mit `kontaktPaket`: nie `privatNotiz`, Werbesperre → kein Paket, 402 = freundlicher Hinweis).
- **Lifecycle (28.09., Regel H4):** `Kontakt.phase?: LifecyclePhase` (`lib/crm/lifecycle.ts`: lead · mql · sql · opportunity · angebot · kunde · follow_up, `LIFECYCLE_WAHL`, `lifecycleAusListe`) — Pipeline-Feld, von Hand über `LifecycleWahl` (Wahl-Chip, kein Leeren). Vorschlag `lifecycleVorschlag` in dieser Reihenfolge: aktives Mandat → kunde · offener Deal in angebot/abschluss → angebot · sonst offener Deal → opportunity · **erst dann** beendetes Mandat/gewonnener Deal → follow_up · Lead SQL → sql · Antwort/Anfrage/Event „da“/Score warm → mql · sonst lead (offener Deal schlägt früheres Mandat). **Ohne gesetzte Phase gilt „Lead“** (`lifecycleVon` → `{ phase: 'lead', vorschlag }`, es wird nichts gespeichert); der Chip zeigt einen Vorschlag nur, wenn er höher als Lead ist (`lifecycleVorschlagHoeher`). Kartei-Spalte/Filter, Segment-Kriterium `lifecycle`, Export `LIFECYCLE_PHASE` (gilt) / `LIFECYCLE_GESETZT` (nur von Hand, sonst leer), Heads `lifecycle` + `lifecycle_verteilung` rechnen mit „gesetzt, sonst Lead“. Import: `ausZeile` belegt aus LIFECYCLE vor, `zusammenfuehren` nur bei leerer Phase — nie überschreiben. Nicht verwechseln mit der Beziehungs-Lebensphase (`phaseVon`, Reiter Daten).
- **BEAN-Kundengruppe (28.09., H4):** `Kontakt.bean` / `Firma.bean` (`'B'|'E'|'A'|'N'`, Handfeld wie `phase`, in `PIPELINE_FELDER`, Import nie). Ableitung rein in `lib/crm/bean.ts` (`beanVon`, `beanFirma`, `beanFuerLead`, `beanVerteilung`) mit Grund, Vorrang **B > A > E > N**: B aktives Mandat (Person oder Firma) · A Deal in angebot/abschluss, Mandat angebot/verhandlung, offenes Angebot der Ablage · E beendetes/pausiertes Mandat, gewonnener Deal ohne aktives Mandat, Lebensphase/Firmen-Rolle `ex_kunde` · N sonst. Lesen: von Hand an der Person → von Hand an der Firma → abgeleitet. Die Dateiablage (`opts.angebote`, Hook `useOffeneAngebote` in `components/os/crm/bean-teile.tsx`) zählt nur in der Oberfläche — Segmente, Export und Heads rechnen ohne sie (nie an Agenten). Oberfläche: `BeanWahl` (Kopf + links + Firmen-Karte; gestrichelt = automatisch, „zurück auf automatisch“), `BeanBadge` (Kartei-Spalte, Leads), Filter in Kartei (`?bean=`, `karteiBean`), Leads und Runde (Pille „Neu“, `RundenFilter.bean`), `BeanVerteilungKarte` im Überblick, Segment-Kriterium `bean` (auch der Server-Speicher `segment()` behält jetzt `temperatur`/`lifecycle`/`bean`), Export-Spalte `BEAN`, Heads `bean` je Person/Lead + `bean_verteilung`.
- **Kontakt öffnen · Reiter Aktivitäten (28.09., H3, nur lokal):** `components/os/crm/kontakt/AktivitaetenReiter.tsx` (+ `aktivitaeten-teile.tsx`), Logik rein in `lib/crm/aktivitaeten.ts` (`aufbereiten` → `filtern`/`zaehlen`/`gruppieren`). Unter-Reiter `u=` alle|notizen|emails|anrufe|aufgaben|meetings; Aufgaben = Follow-ups der Person über `faellige` (kein zweiter Aufgaben-Weg); System (stufe/system/uebergabe) nur unter „Alle“ per Schalter; Zeiten in Europe/Berlin (`berlin()`); Meeting-Zeitpunkt seit H4 als Feld `wann`/`ort` (Altbestand: erste Textzeile, `meetingAusText`). **Anker** `akt-<hash>` (`ankerListe`/`aktivitaetAnker`, FNV über am|art|von|bezug, stabil gegen Textänderung), `akt-fu-<id>`, `akt-kal-<kontaktId>` — Sprung per `#anker`. Eigene Notizen ändern/löschen nur über `POST /api/crm/aktivitaet` mit `aktion: 'aendern'|'loeschen'`, `id`, `anker`, `stand` (H4, Logik `notizAnwenden`: nur Art notiz, nur `von` = angemeldete Person per `personStreng`, sonst 403; veralteter Stand → 409 mit aktuellem Kontakt). Die entfernte Fassung bekommt eine **Löschmarke** `Kontakt.geloeschteAktivitaeten` (`<anker>~<texthash>`, max. 500, `lib/crm/aktivitaet-marke.ts`) — `saeubereKontakt` wirft markierte Fassungen hinaus, `kontaktVereinen` nimmt nur die gespeicherten Marken (nie die aus dem Browser), so kommt nichts zurück und nichts doppelt. **Meetings** tragen `Aktivitaet.wann` (Tag bzw. `YYYY-MM-DDTHH:MM` Berliner Zeit oder ISO mit Zone, `wannSaeubern`) + `ort` (`ortSaeubern`); „+ Meeting“/Schnellaktion schreiben sie, der Text ist die Notiz; `meetingVon` liest Feld vor Text (Altbestand über `meetingAusText`) für „Kommend“ und Sortierung. Jede Antwort der Route trägt den Kontakt mit `stand`. Nichts wird verschickt.
- **Kontakt öffnen · Reiter Umsatz (28.09., H2, nur lokal):** `components/os/crm/kontakt/UmsatzReiter.tsx` (Props fest: `k`, `api`, `zuDeal?`), sechs einklappbare Kacheln (Merker `mt-umsatz-zu`): Umsatz · Zahlungsmöglichkeiten · Verträge · Angebote · Rechnungen · Zahlungseingang. Zuordnung und Kennzahlen NUR in `lib/crm/umsatz.ts` (rein): Mandate/Deals der Person + der Firma (`mandatZuFirma`/`dealZuFirma`), Rechnungen über `mandatId`, sonst per Name (`perName`, Hinweis „per Name zugeordnet“; eine Rechnung eines ANDEREN Mandats nie per Name; Privat nie), Einheit aus Mandat, sonst `Rechnung.firmaId`. Rechnungen schreiben nur über `PATCH /api/state/finanzplan` (`liste: 'rechnungen'`); „bezahlt“ nur über `PATCH { aktion: 'bezahlt', rechnungId, am }` — Status + Buchung `bu-re-<id>` in EINER Sperre (idempotent), wie die Finanzplanung. **Angebote** stehen NICHT als Rechnungsstatus im Finanzplan (die Liquiditätsvorschau zählte jeden fremden Status als sicheren Eingang), sondern in der Dateiablage (`art: 'angebot'`, auch ohne PDF) + abgeleitet aus Rechnungen mit `angebot`/`angebotAm` und Deals in/nach Stufe Angebot (`angeboteListe`).
- **Zahlungsdaten (28.09.):** `Firma.zahlung` bzw. `Kontakt.zahlung` (nur ohne Firma) vom Typ `Zahlungsdaten` (typen.ts), Säuberung/Anzeige `lib/crm/zahlung.ts` (`zahlungSaeubern`: IBAN nur mit gültiger Prüfziffer, SEPA-Daten nur bei SEPA, Link nur https). **IBAN nur maskiert zeigen** (`ibanMaskiert`/`zahlungFuerAnzeige`); jeder Weg nach draußen (Export, Heads, ZOE, Zusammenfassung) nimmt nie `zahlung.iban` — für neue Wege `zahlungOhneIban`.
- **IBAN serverseitig maskiert (28.09., H4):** Nichts an den Browser trägt die volle IBAN: `/api/crm/bestand` (Firmen) und jede Kontakt-Antwort über `fuerPerson` (GET/409 `/api/state/kontakte`, Aktivität, Dubletten, Anfrage, Netzwerk) liefern `zahlungMaskiert` (`iban` maskiert + `ibanGesetzt: true`). Speichern: maskiert/leer/ungültig = unverändert, nur eine neue gültige IBAN ersetzt, Entfernen nur mit `ibanEntfernen: true` — Firmen in `wendeCrmAn` (`ibanSchuetzen`, teil + upsert), Kontakte in der Kartei-Route (`teil` → `zahlungZusammenfuehren`, ganzer Eintrag → `ibanBehalten`). Ausnahme mit Kommentar: Auskunft Art. 15 (`fuerPerson(…, { ibanVoll: true })`) — die IBAN der Person voll, die der Firma maskiert. Neue Routen, die Kontakte/Firmen mit `zahlung` ausgeben: immer maskieren.
- **Dateiablage (28.09.):** `lib/dateien/regeln.ts` (rein: Typen, `dateinameSaeubern`, `typErkennen` am Inhalt, `metaSaeubern`, `eintraegeFuer`) + `lib/dateien/ablage.ts` (Server) + Route `app/api/crm/dateien` (GET Liste/`?id=` Download als attachment mit nosniff/CSP-Sandbox, POST multipart bzw. JSON für Angebote ohne Datei, PATCH Metadaten, DELETE). Inhalt unter `<daten>/dateien/<haushalt>/<id>.bin`, mit `MAKE_OS_DATEN_SCHLUESSEL` als Hülle `MKOSDAT1`+IV+Tag+AES-256-GCM (ohne Schlüssel lokal Klartext wie alles; gelesen wird nach dem Dateikopf); Metadaten im Bestand `crm-dateien--<haushalt>`. Nur PDF/PNG/JPG/DOCX, ≤ 15 MB (Body begrenzt gelesen), Kennungen nur `d-[a-z0-9-]`, jeder Eintrag braucht einen Bezug. Zugang: `imHaushaltDesInhabers` UND benannte Person mit Haushalt (`haushaltVon`) — Dienstweg ohne Person 403, mit Person nur deren Haushalt. `scripts/daten-verschluesselung.mjs` stellt die `.bin` mit um (Schlüssel rotieren). **ZOE liest sie seit 28.09. (C7, Kevin)** nur über `crm_datei_lesen` (Person im Haushalt, gekapselt, Einwilligungs-Belege/Logos nur Angaben, Unterlagen eingeschränkter Kontakte nie) — Heads/Agenten-Pakete lesen die Ablage weiter nicht. Inhalt schreiben/lesen/entfernen nur über `inhaltAblegen`/`inhaltLaden`/`inhaltEntfernen` (geteilt mit den Aufgaben-Dateien); `entfernen` löscht die `.bin` nur, wenn der Eintrag im CRM-Bestand stand (derselbe Ordner trägt die Aufgaben-Dateien). Die CRM-Liste filtert zusätzlich `nurCrm` (Aufgaben-Einträge nie in CRM-Sichten).
- **Dateien an Projekten und Aufgaben (28.09., C2):** gleiche Ablage (Ordner `<daten>/dateien/<haushalt>/`, Hülle, Kennungen `d-…`), aber EIGENER Metadaten-Bestand `aufgaben-dateien--<haushalt>` (`lib/dateien/aufgaben-ablage.ts`; rein: `lib/dateien/aufgaben-regeln.ts`). Einträge tragen `projektId` (Pflicht), `aufgabeId?`, `bereich` (`privat`|`business`, abgeleitet aus dem Space — Browser-Angabe weicht ab → 409); `hatBezug` kennt Projekt/Aufgabe. Typen am INHALT: PDF, PNG, JPG, WEBP, HEIC (ftyp-Marke), DOCX/XLSX/PPTX (ZIP-Verzeichnis mit `[Content_Types].xml` + `word/`/`xl/`/`ppt/`-Hauptteil, Makro-Projekte abgelehnt), CSV/TXT/MD (keine Steuerzeichen/NUL, keine fremde Signatur am Anfang, auch nicht `MKOSDAT1`; UTF-8 oder Windows-1252); ≤ 25 MB. Route `app/api/aufgaben/dateien` (GET `?projektId=`/`?aufgabeId=` mit ETag/304, `?id=` Download attachment/nosniff/CSP-Sandbox, POST multipart `datei`+`meta`, PATCH `{ id, felder: { name?, notiz? } }` — Endung bleibt, DELETE), Zugang wie die CRM-Ablage. Hochladen/Löschen an einer Aufgabe schreibt ihren Verlauf (`was: 'datei'`, `neu`/`entfernt`) direkt in `tasks` — die Oberfläche lädt danach neu (`rehydrate`), sonst gäbe die nächste Änderung 409. Änderungsprotokoll nur Kennung + Feldnamen. Oberfläche `components/os/aufgaben/ProjektDateien.tsx` (`{ projektId, aufgabeId?, space }`). Verbindungsprüfung: `aufgaben-datei-verweis-tot`, `aufgaben-datei-fehlt` (`lib/dateien/aufgaben-pruefung.ts`); ihre `.bin` zählen nicht als „Datei ohne Eintrag“.
- **ZOE-Regel „Aufgaben-Dateien ja, CRM-Ablage nein“ (Kevin 28.09.):** ZOE liest Projekt-/Aufgaben-Dateien und Notizen über `projekt_unterlagen` und `datei_lesen` (`lib/zoe/aufgaben-unterlagen.ts`, Text aus `lib/dateien/text-auslesen.ts`: PDF über pdfjs-dist ohne Worker-Thread, DOCX/XLSX/PPTX aus dem ZIP, Bilder nur Angaben) — nur aus dem Bestand `aufgaben-dateien--…`, nur im Gespräch mit einer Person im Haushalt des Inhabers (angeboten wie die CRM-Werkzeuge; Hintergrundläufe bekommen keine Person → Ablehnung), frei + lesend. Antwort = eigene Kopfzeile (nur Kennungen/Zahlen) + `fremd()`-Block; `SELBST_GEKAPSELT` in `lib/zoe/fremd.ts` → kimmi packt nicht doppelt, das Gespräch gilt als „fremd gelesen“; ins ZOE-Protokoll geht nur die Kopfzeile. Höchstens 30.000 Zeichen je Aufruf (`ZOE_ZEICHEN`), darüber Hinweis + `teil` — nie still gekürzt. Die CRM-Ablage liest seit 28.09. (C7) das eigene Werkzeug `crm_datei_lesen` (Abschnitt „ZOE fürs ganze CRM“) — nicht `datei_lesen`.
- **Angebots-Tool (28.09., A1, nur lokal):** Liste `crm.angebote` (`Angebot` in typen.ts, Beträge in **Cent**), geschrieben NUR über `/api/crm/angebot` (`lib/crm/angebot-server.ts`; der allgemeine Bestand-PATCH lehnt `angebote` mit 409 ab — `regelnAbgelehnt` in speicher.ts). Regeln rein in `lib/crm/angebote.ts` (Summen je Satz über `lib/finanzen/ust.ts`, Nummern `{KURZ}-A-{JAHR}-{NR4}` je Gesellschaft und Jahr über `lauf`, Ablauf, Vorlagen Sie/Du, Deal-Wert, `mandatVorbelegung`, Personenbezug). **Gestellt = festgeschrieben:** Nummer + PDF (pdf-lib, `lib/crm/angebot-pdf.ts`, Aufbau `angebot-dokument.ts` = auch die HTML-Vorschau) + SHA-256 in EINER Sperre (`aendereCrmAsync`); PDF in der Dateiablage mit `angebotId` (fester Bezug, nur Server, `istBeleg` → nicht löschbar). Änderung nur als neue Version (`vorgaengerId`, alte → „ersetzt“). Stellen verbindet: Deal (vorhanden oder `dealAnlegen`) auf „angebot“, Follow-up `fu-<angebot>`, Aktivität am Kontakt, BEAN liest `crm.angebote`; angenommen → Deal gewonnen, `/api/crm/lead` aktion „mandat“ belegt aus dem angenommenen Angebot vor; abgelehnt → Grund Pflicht. Kanal-Ampel: Werbesperre/Einschränkung blockt (`ampelVorStellen`). Art. 17: Entwürfe weg, gestellte Personenbezug lösen (`angebotePersonOhne`). Oberfläche `components/os/crm/angebot/` (AngebotStart · Editor · Positionen · Vorschau · Ansicht · Liste · Blatt).
- **Gesellschaften (Absender, 28.09.):** `lib/crm/gesellschaften.ts`, Speicher `gesellschaften--<haushalt>` (nie im Code), Route `/api/crm/gesellschaften` (Haushalt des Inhabers + Person mit Haushalt, Stand/409, Logo nur PNG/JPG in die Ablage mit Bezug `gesellschaft`), Stammdaten › Gesellschaften. IBAN wie bei Kunden nur maskiert (im PDF voll). **Produkte:** `Leistung.angebot` (Leistungstext Pflicht für „aktiv“, Server 409; `produktAngebotFehlt`).
- **CRM-Schreibregeln (28.09. abends, Prüfung + R1–R4):** Kartei nur über `aendereKontakte`/`aendereKontakteAsync` (lib/crm/kartei-schreiben.ts, protokolliert ohne Werte; Test-Wache meldet direkte `updateJson('kontakte')` außerhalb der erlaubten Stellen). **Sperr-Reihenfolge immer crm → kontakte**: `aendereCrm` sperrt `crm` und darin `kontakte` (Lead-Folgen, Personen-Schranke Art. 18/Werbesperre in `lib/crm/personen-schranke.ts`); nie innerhalb einer Kartei-Sperre `aendereCrm` aufrufen. Browser: Kontakt-Schreibvorgänge nur über die Kette in `lib/crm/kontakt-schreiben.ts` (Stand aus der letzten Serverantwort), Meldungen über `FehlerHinweis` (bleiben stehen, `laden` löscht sie nicht). Zugang: `imHaushaltDesInhabers` ist beim Dienstweg streng (Person muss im Haushalt sein, ohne Person null); Systemläufe ohne Person nur über `imHaushaltOderSystemlauf` (Kartei lesen, Kalender/Erinnerungen vom Mac). ZOE-CRM-Werkzeuge nur mit Person im Haushalt. Dubletten: Vorschau `wasWandert` + Rückgängig (`lib/crm/zusammenfuehren-lauf.ts`). Löschen: `loeschSperren`/`loeschKaskade` (crm-stand.ts), Events nur über `POST /api/crm/events {aktion:'loeschen'}`. Art. 17 tilgt Namen in Deal-Titeln/Mandat-Kunde (`crmNamenTilgen`); neue Deal-Titel ohne vollen Personennamen.
- **Verbindungsprüfung (28.09., V1):** `lib/crm/verbindungen.ts` (rein: `verbindungenPruefen` → Befunde mit Schwere/Anzahl/Kennungen, `verbindungenReparieren` nur sichere Fälle, Katalog `PRUEFUNGEN`), Laden `lib/crm/verbindungen-laden.ts`, Route `app/api/crm/verbindungen` (GET ETag · POST `{ ids, vorschau }`, Haushalt des Inhabers + benannte Person), Karte Stammdaten › Datenqualität, Fehler auch in `lib/crm/befunde.ts`. **Jede neue Verknüpfung (neue Kennung, die auf eine andere zeigt) dort mitprüfen** — Prüfung + Satz in `PRUEFUNGEN`, Fall in `tests/crm-verbindungen.test.ts` (der Test verlangt je Prüfung einen Fall). Reparieren löscht nie Datensätze und fasst keine Zeitstempel an. Zahlen: `scripts/verbindungen-pruefen.mjs` (nur Kennung/Schwere/Anzahl).
- **Normalisierung (28.09., K2):** alle Normalisierer beginnen mit `.normalize('NFC')` (auch `csvLesen`). Schlüssel `schluessel` (lib/make-one/crm.ts): persönliche E-Mail (`mailSchluessel`: nur NFC/trim/klein — `-`, `_`, `+` bleiben) → HubSpot-ID → Name+Firma (`normName`/`normFirma`, „G.m.b.H.“/„GmbH & Co. KG“ erkannt); Sammeladressen (`istSammelAdresse`: info@, kontakt@, team@ …) nie als Personenschlüssel. EINE Telefonform `normTelefon` („+49…“) für Import und Dubletten. Suche überall `suchNorm`/`suchPasst` (lib/text/such-norm.ts) — keine eigene Such-Regel bauen. Übergang: `importieren` prüft nach dem neuen auch den alten Schlüssel (`schluesselAlt`, nur eindeutig, nicht doppelt, Namen verträglich) — bei einer künftigen Schlüsseländerung genauso verfahren. Datum aus Listen nur über `datumAusListe`.
- **Sperrliste (28.09., K2):** `lib/crm/sperrliste.ts`, Speicher `crm-sperrliste--<haushalt>` (Haushalt des Inhabers, `karteiHaushalt()`, Ersatz „haupt“) — nur Fingerabdrücke der Merkmale (`identitaetsMerkmale`; seit 29.09. HMAC v2 mit Pepper, v1 SHA-256 wird weiter geprüft), Grund, Tag; nie Klartext. Einträge bei Werbesperre (Kartei-PATCH, Aktivität/Follow-up „Sperre“, vor jedem Import `sperrlisteNachtragen`) und Art. 17 (`personEntfernen`); `importieren(…, { gesperrt })` legt Gesperrte nicht an. Werbesperre aufheben nur per `teil` mit neuer Einwilligung + Nachweis (`sperreAufhebenPruefen`, sonst 409), System-Aktivität `sperreAufhebenVermerk`, dann `entsperren`; ein ganzer Eintrag hebt nie auf (`sperreBehalten`). Neue Wege, die `werbesperre` setzen: `sperren([k], 'werbesperre', tag)` rufen.
- **Import-Lauf (28.09., K2):** `lib/crm/import-lauf.ts`, Speicher `crm-import-laeufe--<haushalt>` — Vorher-Stand der geänderten + Kennungen der neuen Kontakte, abgelegt in derselben Sperre VOR dem Schreiben (`updateJsonAsync`), Fingerabdrücke nach dem Firmen-Abgleich; `POST /api/crm/import { aktion: 'rueckgaengig', laufId }` nur für seitdem unveränderte (neue: auch nicht verknüpft), sonst Konflikt; 30 Tage. Art. 17 räumt die Läufe (`laufOhne`). Server stempelt `geaendertAm`/`importiertAm`/`vonHand` (`serverStempel`); Aktivitäten/Einwilligungen nie kürzen (`AKTIVITAETEN_MAX` 10.000 / `EINWILLIGUNGEN_MAX` 500 → 413).
- **Personenbezug nur über `lib/crm/person-bestaende.ts` (28.09., F2)** — `personAufzaehlen` (Art. 15), `personEntfernen` (Art. 17, auch `op:'delete'` der Kartei; seit 29.09. als Vorgang mit Absichtsprotokoll), `personUmbiegen` (Dubletten; seit 29.09. über `personenUmbiegen` für viele Paare — Kennungs-Umzug) über alle Speicher; jeder neue Speicher mit Personenbezug gehört dort hinein. Archiv-Kopien nur über `lib/store/archiv.ts` (verschlüsselt wie die Bestände).
- **Register aller Bestände (29.09., D-B #69/#74):** JEDER Bestandsname steht in `lib/crm/speicher-register.ts` (Bezug dritte/haushalt/kein, Behandlung entfernen/tilgen/pseudonym/ausgenommen + Grund) — der Wächter `tests/datenschutz-register.test.ts` scannt alle `loadJson/updateJson/saveJson…('<name>')` und wird rot bei einem neuen Namen. Die weiteren Speicher (netzwerk, kunden, stammdaten, Postfach-/Kalender-Caches, meetings, zoe-*, zoe-entscheidungen--*, aenderungsprotokoll--*, agent-log, meldungen--*, Umzugs-Kopien im Archiv) räumt `lib/crm/person-weitere.ts` (`WEITERE_SPEICHER`: Einträge der Person raus bzw. Kennung/Adresse/Name/Fingerabdruck → „[gelöscht]“/`c#geloescht`); danach wird der Such-Index `app_chunks` sofort nachgezogen und — falls an — der `_App`-Spiegel neu erzeugt. Löschprotokoll nur mit Protokoll-ID `lp-…` (`lib/crm/loeschprotokoll.ts`), nie die Kennung.
- **Grabsteine (29.09., D-B #70, `lib/datenschutz/grabsteine.ts`):** Art. 17 legt einen Grabstein (HMAC der Kennung + Sperrlisten-Hashes, nie Klartext) AUSSERHALB des Datenordners ab (`MAKE_OS_GRABSTEINE_DIR`, Standard `<daten>-grabsteine`, in Tests `<daten>/.grabsteine-test`). Angewendet (Person erneut entfernen + Sperrliste) im Löschfristen-Lauf, sobald die Grabsteine neuer sind als ihre Marke `datenschutz-grabsteine` (nach jedem Restore also beim nächsten Takt), nach jedem Einzel-Restore (`/api/intern/wiederherstellen`) und ZWINGEND im Restore-Skript (`deploy/wiederherstellen.sh` → `POST /api/crm/datenschutz { aktion: 'grabsteine' }`, Dienstweg ohne Person). Frist 13 Monate. Neue Restore-Wege: Grabsteine anwenden.
- **Fingerabdrücke mit Pepper (29.09., D-B #71/#68, `lib/datenschutz/pepper.ts`):** Sperrliste, `protokollKennung` (`c2#…`) und Grabsteine = HMAC-SHA-256 mit `MAKE_OS_PEPPER` (bzw. `MAKE_OS_PEPPER_DATEI`), getrennt vom Datenschlüssel, nie wechseln. Ohne Pepper v1 (ungesalzen, gelbe Warnung im HOI). Geprüft wird gegen v2 UND v1 (`sperrHashesAlle`, `protokollKennungen`); der Löschfristen-Lauf rechnet v1 einmal je Pepper für existierende Kontakte um (Marke `datenschutz-migration`) — v1 gelöschter Personen bleibt gültig. Nie eigene `createHash` über Personenmerkmale bauen.
- **Art. 18 zentral (29.09., D-B #72):** wer VERARBEITET (Ansprache, Power Hour, Pakete ans Modell, Export, ZOE), liest die Kartei über `kontakteFuerVerarbeitung()` (`lib/crm/verarbeitung.ts`, eingeschränkte fehlen). Direktes `loadJson('kontakte')` nur in `KONTAKTE_LESER_ERLAUBT` (mit Grund) — der Wächtertest ist sonst rot; in `lib/zoe` nur `crm-sicht.ts` (`crmSicht`, `karteiFuerPruefung` nur für Prüfungen). CSV-Export ohne eingeschränkte Personen, außer `?mitEingeschraenkten=1` (Schalter in Stammdaten › Austausch, nur für eine Auskunft).
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
- **Rechenkern:** `lib/finanzen/rechenkern.ts` (Kevins v3, **geändert am 02.10. auf Kevins ausdrückliches Wort — siehe „Kern-Umbau 02.10.“ unten**) ist DIE eine Wahrheit der Rechnung — nie daneben rechnen; Steuern/Netto sind Näherungen (im UI „Hinweis, keine Steuerberatung“). Monat 1 = Okt 26, Historie Jan–Sep 26.
- **Oberfläche:** `/os/finanzplan` (`components/os/finanzplan/`, Eintrag in `EIGEN` unter Agenten): Blatt mit Excel-Bedienung, Wer-Strich aus den CRM-Teamfarben, Rückgängig lokal als Gegenoperation, Verbergen, Meldung nach jedem Speichern. Regel „merken“ (`/regeln/<empfänger>`) wirkt rückwirkend und ist nicht rückgängig-fähig.
- **Regeln:** Änderungen nur als Operationen (nie das Dokument zurückschreiben), Protokoll und Zellen-Meta schreibt der Server, `wer` = Speichername des Kontos. Plan/Stand/Abweichungen: `FINANZPLANUNG_JETZT.md`.
- **Szenario-Baukasten (27.09. abends):** `lib/finanzen/szenarien.ts` löst Bausteine (Umsatz = Produkt × Kunde × Preis × Menge × Rhythmus × Start × Laufzeit × Zahlungsziel; Kosten = Stelle/Software/Miete/Rate) und Szenario-Annahmen in Monatsreihen (`Zusatz`) auf und füttert den Kern — der Kern addiert nur, ohne Zusatz rechnet er wie bisher (nie im Kern interpretieren). Speicher: `planszenarien[]` + `arbeitsplan` im Plan-Dokument (Operationen wie sonst; fehlen sie, gilt der reine Treiber). `rechne()`/`kennzahlenVon()` rechnen immer mit dem Arbeitsplan. Produkte sind die eine Quelle der Umsatzbausteine (`lib/finanzen/produkte.ts`, nur lesen; `Leistung.preis.basis`, `laufzeitMonate`, `aufwand` in `lib/crm/typen.ts`); Route `GET /api/finanzplan/vorschlaege`. Navigation: acht Bereiche (Lage · Planen · Privat · Business · Gesamt · Buchungen & Check · Ziele & Töpfe · Protokoll), alte `?u=` lösen weiter auf.
- **Kern-Umbau 02.10. (Kevin entschied ausdrücklich, den Rechenkern zu ändern — die Regel „Namen/Formeln unverändert bis Kevins Wort“ ist für genau diese vier Punkte aufgehoben; alles andere im Kern bleibt unter dieser Regel):** (1) **Ertragsteuern einzeln** statt EINER Quote — `lib/finanzen/ertragsteuer.ts` (rein, `neuerSteuerrechner`/`jahresSteuer`): Kapitalgesellschaften (MAKE Innovation GmbH, KD Ventures; Rechtsform aus `lib/finanzen/steuern.ts`) rechnen Körperschaftsteuer 15 % + Soli 5,5 % auf die KSt + Gewerbesteuer (Messzahl 3,5 % × Hebesatz), einfacher Verlustvortrag, Zahlung im Folgejahr oder Vorauszahlung je Quartal; KD Ventures hat eine eigene Rechnung im Monatsraster (laufendes Ergebnis aus Bausteinen; die pauschale Steuer auf den Ausstieg kommt zusätzlich, der Ausstieg selbst ist nicht noch einmal KSt/GewSt-pflichtig); Einzelunternehmen: Gewerbesteuer mit Freibetrag 24.500 € und Anrechnung nach § 35 EStG (Faktor × Messbetrag, gedeckelt). USt bleibt Durchlauf. (2) **Selbstständigkeit mit eigener Monatsachse** (`rechneSelbstAchse` → `MonatSelbst`, `Zusatz.kdc*`): Umsatz/Kosten aus ihren Bausteinen und aus Sachkosten-Zeilen mit `einheit: 'selbststaendigkeit'`, eigenes Konto (Start `selbst.kontoStart`), USt-Durchlauf, Entnahme → Privat; Bausteine ohne Zuordnung bleiben bei MAKE. `rechneMit()` liefert `kdc` neben `ug`/`pr`; `auswertung`, `kennzahlen`, `zielStaende`, `zahlungskalender` nehmen es als letzten Parameter. (3) **Einkommensteuer der Selbstständigkeit** nach Grundtarif (`estTarif`, Eckwerte einstellbar, Vorgabe 2026; `est2026` bleibt als Kurzform) auf das Ergebnis minus Vorsorge/Sonderausgaben — keine privaten Einkünfte aufaddiert (der Kern kennt nur Netto-Beträge). (4) **`ruecklage5a` und `notgroschenMonate` gelöscht** (Typ, Säuberer, Oberfläche, Tests); `pruefeDokument` ignoriert sie beim Lesen. **Kevins Zusatz „alles anpassen, damit ich selber spielen kann“:** jeder neue Parameter ist ein Feld mit Vorgabe, nie eine Konstante — KSt-/Soli-Satz, Messzahl, Hebesatz, Freibetrag, Anrechnungsfaktor, Verlustvortrag an/aus, Zahlweise, Zahlmonat, Tarif-Eckwerte (je Gesellschaft, `FinanzDaten.steuern[ort].zeilen/param`), Steuer auf den Ausstieg und Entnahme-Regel (je Szenario, `PlanAnnahmen.exitSteuer/entnahme/steuern`). Leer = Vorgabe (`steuerParameter()` setzt sie ein; der Hebesatz der Vorgabe wird aus dem früheren Gesamtsatz `annahmen.steuerUG` abgeleitet, damit bei unveränderten Eingaben dieselbe Gesamtquote herauskommt), Oberfläche: Karte „Welche Steuern gelten?“ (`SteuerKarte`, Felder aus `steuerFelder()` mit grauem Platzhalter und „zurücksetzen“, Bereich „ganzer Plan“ oder „nur Arbeitsplan“, im Baukasten je Szenario). Neue Steuer-/Kern-Parameter immer so bauen (Feld in `steuerFelder`, Test „geändert wirkt, geleert = Vorgabe“ in `tests/kern-steuern.test.ts`). Näherungen und Vorher-Nachher-Bericht: `FINANZPLANUNG_JETZT.md` › „Kern-Umbau 02.10.“. Regressionswächter: `tests/finanzplan-regression.test.ts` (Gold aus dem alten Kern c83cb1f in `tests/fixtures/kern-vorher-gold.json`).

- **Jede Zahl bearbeitbar, Formeln fest — Handwert-Schicht an EINER Stelle (04.10., Kevins Wort):** Jede gerechnete Zahl des Finanzplans ist
  von Hand überschreibbar. Ein Handwert ist `plan["<kennung>:<monat>"]` (Monat 0 = ohne Monat), der Kern liest ihn NUR über `hand()` in
  `lib/finanzen/rechenkern.ts` (Steuern über das `hand`-Argument von `neuerSteuerrechner`); Kennungen, Namen und „wirkt auf“ stehen NUR in
  `HAND_FELDER` (`lib/finanzen/handwerte.ts`). Die Formeln bleiben unverändert (Regel „Namen/Formeln unverändert bis Kevins Wort“ gilt weiter);
  ohne Handwert rechnet der Kern bit-genau wie vorher — Summen mit Handwert wirken nur über ihre Abweichung (ohne Handwert genau 0).
  **Neue gerechnete Größe = Eintrag in `HAND_FELDER` + `h('<kennung>', m, …)` im Kern + Zeile mit `edit: '<kennung>'` im Blatt** (je Blatt jede
  Kennung höchstens einmal; Minus-Zeilen mit `minus: true`); Test „Handwert = Formelwert ändert keine Zahl“ läuft automatisch über alle Kennungen.
  Schreiben nur über die Operationen (`/plan/…`, Zahl, Monat 0 … Planlänge, `GRENZE_PLAN_ZELLEN` → 413). Gestellte Rechnungen sind keine Handwerte
  (`rechnungSchutz` bleibt). Nachtrag 04.10. (Kevins Antworten): Handwert nur in einem Szenario = `plan["<kennung>@<szenario>:<monat>"]`, Vorrang
  Szenario › alle › Formel, nur über `planMitSzenario` (rechneMit); Umsatz-Summe von Hand zieht den Eingang mit (Zahlungsziel-Vorgabe des
  Arbeitsplans, `Zusatz.umsatzZiel`); Steuer-Handwerte wandern in die Quartals-Vorauszahlungen. Details: `FINANZPLANUNG_JETZT.md` › „Jede Zahl bearbeitbar“.

- **Finanzplanung unter Finanzen › Privat und › Business (04.10., Kevin: „Business ist bei Business sichtbar, kein Privat. Bei Privat kann man
  alles sehen … Im Business-Bereich sieht man Privat nicht.“):** EINE Komponente `Finanzplan({ sicht, eingebettet })` als Reiter
  „Finanzplanung“ in `FinanzenView` — Adresse `/os/finanzen?s=finanzplanung&space=privat|business&u=<Unterseite>` (`finanzplanAdresse`).
  Privat-Sicht = alles (auch die Firmen). Business-Sicht = nur die Gesellschaften: **Trennung an EINER Stelle, serverseitig**
  (`lib/finanzen/plan/sicht.ts`): `GET /api/finanzplan?sicht=business` liefert `businessSicht(d)` (Privat-Zeilen, private Buchungen/Posten/
  Schulden/Ziele/Ereignisse/Bausteine, Check, Fokus, Abschlüsse, Regeln, Schwellen, Netto-Tabelle, Ausschüttungssteuer, `p.*`/`g.*`- und
  private Zeilen-Schlüssel in plan/ist/notizen/meta und Protokolleinträge ohne sicheren Business-Pfad werden gar nicht ausgeliefert, auch nicht in der
  409-Antwort); `PATCH ?sicht=business` prüft jeden Schritt mit `businessPfadErlaubt` in der Sperre → 403. Protokolleinträge tragen seit 04.10.
  `pfad`. Oberfläche: `bereicheFuer`/`unterseiteFuer` (keine Unterseiten Privat, Budget, Wochen-Check, Entwicklung, Geldfluss), `LageBusiness`,
  `GesamtBusiness`, `FRAGE_BUSINESS`; Einrichten/Import nur in der Privat-Sicht. `/os/finanzplan?…` leitet in die Privat-Sicht weiter (alle
  Parameter bleiben); der Eintrag unter den Agenten ist weg. Neue Teile des Finanzplans: Privat oder Business? → in `sicht.ts` einordnen
  (Wächter `tests/finanzplan-sicht.test.ts`). Die Sicht kommt heute aus der Adresse (gleicher Haushalt); für Teammitglieder ohne Privatzugang
  erzwingt der Server sie später je Person (`sichtAus`).

## Tempo (27.09.)
- Tempo misst man im **Prüfbau** (`make-os-pruefbau`, Port 3011, `MAKE_OS_DIST=.next-pruefbau npx next build`) oder auf dem Server — nie auf 3001 (Entwicklungsmodus übersetzt jede Seite beim ersten Aufruf).
- **Prüfbau und Dev-Server teilen `.data` (28.09., K1 #40):** `make-os-pruefbau` (3011) und `make-os-entwicklung` (3001) lesen und schreiben denselben Datenordner — nie gleichzeitig schreibend benutzen (einen anhalten, bevor im anderen geklickt wird). `scripts/daten-verschluesselung.mjs` bricht ab, solange eine lebende App das Lockfile `.data/.schreiber` hält (29.09.), und warnt zusätzlich, wenn auf 3000/3001/3011 eine App läuft; der HOI meldet einen zweiten Schreiber.
- Der Live-Server hat **1 vCPU / 1,9 GB**: alles, was pro Anfrage rechnet, reiht sich hintereinander. Deshalb: keine externen Aufrufe (iCloud, Modell) im Seitenpfad, keine neuen Poller unter 30 s, jede große GET-Antwort mit `etagAus`/`unveraendert`/`jsonAntwort` (`lib/http/json-antwort.ts`).
- Der **Anfrage-Bündler** (`lib/http/anfrage-buendel.ts`) liegt vor dem Browser-fetch: gleiche GETs an /api teilen sich eine Antwort (laufend immer, fertig 8 s; `cache: 'no-store'` = nur laufend). Schreibende Aufrufe leeren ihn und zählen die Generation hoch (Start + Ende) — ein GET aus einer älteren Generation wird weder geteilt noch frisch gehalten. Wer wirklich frisch lesen muss, nimmt `no-store`.
- **Memo** merkt unter dem Stand vom START der Rechnung — wer während der Rechnung schreibt, macht das Ergebnis ungültig; eine ältere Rechnung überschreibt nie eine jüngere.
- **Memo-Rauschen** (`lib/store/memo.ts` RAUSCHEN): Bestände, die oft geschrieben werden, aber in keinen Index eingehen. Neuer Bestand mit hoher Schreibfrequenz? Dort eintragen, sonst ist der Zwischenspeicher der Indizes wieder nie warm.
- Embeddings laufen nur ab 3 CPUs (`embeddingsErlaubt`), Brain-Index-Abgleich alle 30 Min., Arbeiter höchstens 2 Läufe auf kleinen Maschinen.

## ZOE (27.09.)
- Der Assistent heißt **ZOE** (immer groß in Texten). Code: `lib/zoe`, `app/zoe`, `/api/zoe/*`, Bestände `zoe-*`. Alte `jarvis-*`-Dateien werden beim ersten Lesen übernommen (local-db); `/jarvis` und `/api/jarvis/*` leiten um — beides nicht entfernen, solange alte Arbeiter, Boten oder Lesezeichen leben.

### ZOE-Aufgaben & Stapel-Arten (28.09. spät, Paket C4)
- **Ablauf:** `Task.zoe.status` offen → in_arbeit → wartet_freigabe → freigegeben | abgelehnt. Geben/Zurückholen/Freigeben/Ablehnen/Lauf nur über `/api/aufgaben/zoe` (`aktion: geben|zurueck|arbeiten|freigeben|ablehnen`, Haushalt des Inhabers, sonst 403) bzw. ZOE `aufgabe_an_zoe`/`meine_aufgaben` (lib/zoe/aufgaben-werkzeuge.ts, per Spread in werkzeuge.ts/register.ts). **Auftraggeberin** = `zoe.von` (setzt der Server auf die schreibende Person; Altbestand: letzter Verlauf-Eintrag „zoe → offen“, `auftraggeberinVon`), nie `assignee` — nur sie sieht und entscheidet den Vorschlag (Regel 5). Hinweis an ZOE = `zoe.hinweis` (≤ 1.000 Zeichen, sonst 413; Altbestand: Kommentar „Hinweis an ZOE: …“, `zoeHinweis`). Statuswechsel behalten `von`/`hinweis` (`{ ...zoe, status }`). Regeln rein in `lib/aufgaben/zoe.ts`; `zoeAufgaben(state)` liefert die Sicht „ZOE“ (Aufgaben › Ansicht ZOE) und die Überblick-Kachel (`wartet`).
- **Lauf** (`lib/zoe/aufgaben-lauf.ts` `zoeAufgabenLauf({ person | null, max })`): Knopf = nur eigene Aufträge, Takt-Systemlauf `zoe-aufgaben` (einmal am Tag nach dem Morgenlauf, nur wenn etwas offen liegt) = alle, je Auftrag im Namen der Auftraggeberin. Höchstens `LAUF_MAX` (5) je Lauf, ohne Schlüssel/Guthaben keine Änderung, ein Lauf je Prozess, `modellSchranke` in der Route. EIN Modellaufruf je Aufgabe **ohne Werkzeuge** (nur JSON → `vorschlagSauber`: Entwurf, Unteraufgaben ≤ 8, Status, Deadline). Alles aus Bestand/Kartei/Ablage steht in `fremd()` — CRM nur `crmKurzinfo` (nie Notizen/Kontaktdaten/IBAN, Sperre → keine Angaben), Dateien nur aus der Aufgaben-Ablage (nie CRM-Ablage), Inhalt ≤ `ZOE_ZEICHEN`. Ergebnis NUR als Stapel-Eintrag; die Aufgabe ändert sich inhaltlich nicht (nur `zoe`, Verlauf `durch: 'zoe'`), Meldung Art `zoe` an die Auftraggeberin.
- **Stapel-Arten** (`lib/zoe/stapel-arten.ts`): Vorschläge mit `bezug { art, id }` laufen nie über `fuehreAus` — je Art `freigeben` (übernimmt über den eigenen Schreibweg und entscheidet den Eintrag selbst; schlägt es fehl, bleibt er offen) und optional `nachAblehnen`. `bezug` setzt nur der Server-Lauf der Art (`lege`), nie ein Werkzeug; unbekannte Art → 409. Neue Art (z. B. „crm“, C7): `StapelArt` in stapel.ts + Eintrag in `ARTEN` (dynamischer Import).
- **Übernehmen** nur über `vorschlagFreigeben` → `aufgabeZoeAendern` (frisch lesen, Stand der Zeile, ohne Browser-Stand bis 3 Versuche, mit Stand 409): Entwurf an die Notiz (auf der untersten Ebene — 5 — werden Unteraufgaben zur Checkliste, sonst echte Unteraufgaben), Unteraufgaben anlegen, Status/Deadline setzen, `zoe.status = freigegeben`. Kein Löschen, kein Versand — auch „Ändern & freigeben“ im Stapel wird neu gesäubert und bleibt bei derselben Aufgabe. Tests: `tests/zoe-aufgaben.test.ts`.

### ZOE fürs ganze CRM — die komplette Markttraktion (28.09. spät, Paket C7, Kevin: „ZOE soll alles sehen und unterstützen können“)
- **Regel:** ZOE liest CRM und CRM-Ablage für Personen im Haushalt des Inhabers, gekapselt; ZOE schreibt NUR über den Freigabe-Stapel
  (Stapel-Art „crm“), nichts direkt, nichts nach außen. **Seit 29.09. (Kevin, D-B #90) auch die alten Werkzeuge:** `notiere_kontakt`, `chance_anlegen`,
  `uebergeben`, `setze_kunde` sind `freigabe` (auch VOR jedem Fremdtext), `create_task` für eine andere Person ebenso (`risikoFuer` im Register,
  `risikoFuerAufruf` — verschärft nur). `run_agent` geht durch `agentNurVorschlag` (nach Fremdtext nur Lese-Agenten, sonst Auftrag als Vorschlag über
  `starte_auftraege`); Web-Agenten (research, content, prospect) nach einem vertraulichen Leser im selben Gespräch (auch früherer Zug, `ran` im Verlauf)
  nur als Vorschlag (#91). Übernommene Aktivitäten tragen `quelle: 'zoe'` + `freigegebenVon` (#94; `fuehreAus` gibt `freigegebenVon` nur bei der Freigabe
  mit, nie aus der Eingabe). ZOE-Protokoll hält nur Kennungen + Feldnamen (`eingabeKurz`), Frist 90 Tage für Protokoll und entschiedene Vorschläge
  (Löschklasse „zoe-arbeitslisten“), Art. 15/17 über `person-bestaende`. Feste Leitplanken — an EINER Stelle, `lib/zoe/crm-sicht.ts` (`crmSicht`/`sichtAus`):
  **Art. 18** eingeschränkte Kontakte fehlen ganz (nur „n eingeschränkte Kontakte ausgeblendet“, an Deals/Mandaten/Events „eingeschränkter Kontakt“),
  **private Notizen** nur die der handelnden Person (`fuerPerson`), **IBAN** maskiert (Kontakte über `fuerPerson`, Firmen beim Laden, Gesellschaften
  über `gesellschaftFuerAnzeige`). Alles Fremde (Notizen, Aktivitäten, Mails, Dateiinhalte) steht im `fremd()`-Block hinter einer eigenen Kopfzeile
  (nur Kennungen/Zahlen, nur sie geht ins ZOE-Protokoll); über `ZOE_ZEICHEN` (30.000) → „Teil x von y“ + `teil`, nie still gekürzt (`crmAntwort`).
  Neue CRM-Leser: IMMER über `crmSicht` — nie `loadJson('kontakte')` direkt an ZOE.
- **Lesen** (`lib/zoe/crm-werkzeuge.ts`, alle frei + `SELBST_GEKAPSELT`, in `LESEND`): `crm_suche` (Kontakte/Firmen/Deals/Mandate/Angebote/Kampagnen/Events,
  Filter Phase · BEAN · Temperatur/Score · Segment · Zuständig · Stadt · Branche · offen · fällig, `suchPasst`), `kontakt_akte`, `firma_akte`, `pipeline`
  (mit `deal` = Deal-Akte), `mandate_lage`, `angebote_lage`, `kampagnen_lage`, `events_lage`, `marketing_lage`, `kennzahlen` (Traktions-Index + alle
  Kennzahlen + Befunde), `sales_lage` (Power Hour, Team, Auswertung), `qualifizierung_lage` (Qualifizierungs-, Kreis-, Vernetzen-Runde), `stammdaten_lage`,
  `datenqualitaet` (Verbindungsprüfung, Dubletten mit `wasWandert`), `crm_datei_lesen`, `heads_lage` (offene Head-Vorschläge, eingeschränkte ausgeblendet). `suche_kontakt`/`crm_lage` behalten Namen und Aufrufe, laufen aber
  über dieselbe Sicht; `kontaktFinden` (notiere_kontakt, entwurf_ansprache, chance_anlegen, uebergeben) findet eingeschränkte Personen nicht mehr.
- **Unterstützen** (`lib/zoe/crm-vorschlag.ts`): Werkzeug `crm_vorschlag` (frei, weil es NUR ablegt — auch nach Fremdtext) prüft gegen den Bestand
  (Art. 18, Werbesperre, Kanal-Ampel rot → abgelehnt, Anlass-Pflicht beim Anruf), rechnet Vorher/Nachher, hält Stände fest (Kontakt, Deal, Lead, Produkt,
  Angebot, beide Dubletten — Rohdatensatz, `fingerabdruck`) und legt `lege({ …, bezug: { art: 'crm', id: '<art>:<kennung>' } })` ab. Arten: aktivitaet,
  followup, followup_verschieben, deal_anlegen, deal_aendern, kontakt_felder (Whitelist; Einwilligung/Werbesperre/Einschränkung nie), aufgabe, qualifizierung,
  dubletten, reparatur, import_konflikt, angebot_entwurf (nur `speichern`, nie `stellen`), Text zum Kopieren (nachricht_entwurf, anruf_leitfaden,
  powerhour_reihenfolge, einladung_entwurf, danke_entwurf — `_mailto` nur bei nicht roter Ampel), beitrag_entwurf, newsletter_entwurf, segment, gaesteliste
  (nur zulässiger Einladungskanal, „vorgemerkt“), leistungstext (optional aktiv), head_entscheiden (Head-Vorschlag annehmen/ablehnen mit Grund aus
  `ABLEHNGRUENDE` — über `POST /api/heads/[head]` `entscheiden`, nur solange er offen ist; die Head-Läufe und ihr Fenster bleiben, wie sie sind). **Freigabe** nur per Klick (`CRM_STAPEL_ART.freigeben`, nur die Person, für
  die vorbereitet wurde): die Route läuft im Prozess mit Dienstschlüssel + `x-make-person` (`innen()`, Regel 7) — dieselben Prüfungen wie ein Klick
  (409 bei Stand, Art.-18-/Werbesperre-Sperren, Deal-Regeln), Protokoll `{ art: 'zoe', person }`; schlägt es fehl, bleibt der Vorschlag offen. Neue Art:
  `VORSCHLAG_ARTEN` + `planen` + `ausfuehren` — Schreiben immer über die bestehende Route, nie am Speicher vorbei.
- **Oberfläche:** „ZOE fragen“ (`components/os/crm/ZoeFragen.tsx`, Ereignis `make-zoe-fragen`) im Kopf der Markttraktion (Bezug aus offenem
  Kontakt/Firma/Deal/Angebot oder dem Reiter, `zoeBezugFuer` in `lib/zoe/crm-bezug.ts`) und in der Firmenakte; `ZoePanel` zeigt den Bezug und schickt ihn
  mit (`bezug` = nur Art + geprüfte Kennung, kein Text Dritter — `crmBezugAus`; kimmi nimmt ihn nur im Haushalt, `crmBezugHinweis`). Karte
  „ZOE-Vorschläge“ in Kontakt öffnen (rechts) und Firmenakte (`ZoeVorschlaege`, `passtZuBezug`), freigeben/ablehnen mit Grund über `/api/zoe/stapel`;
  im Stapel zeigt `CrmStapelDetail` Text zum Kopieren, Mail-Programm und den Sprung in die Markttraktion.
- **Organisatorisch offen:** Auftragsverarbeitungsvertrag (AVV) mit dem KI-Anbieter ablegen — ZOE schickt jetzt CRM-Inhalte (gekapselt) ans Modell
  (CRM_FEHLER_ABGLEICH #101). Tests: `tests/zoe-crm.test.ts`.

### Qualifizierung & Scoring (03.10., Branch `quali`, nur lokal) — Details in `SCORING.md`
- **Reiter:** der Schnellknopf `qualifizierung` heißt „Qualifizierung & Scoring“ (Kennung und alte Links bleiben; `a` leer = Runde · `scoring` = Marketing-Scoring · `scoring-sales`; `k` = Lead-Sprung; Link nur über `qualifizierungLink`). Host `components/os/crm/quali/QualifizierungScoring.tsx`.
- **Eine Rechnung:** `lib/crm/scoring.ts` (rein) rechnet Marketing (gemessene Signale → MQL) und Sales (Fragen mit Stufen → SQL, Muss-Kriterien, Deckel, Gewicht, Schwellen) aus `ScoringEinstellungen`; `leadScore` (score.ts) ist die Brücke (`LeadScore.scoring`), `leads()` übergibt `scoringKontext(crm)` — **jede Stelle, die einen Score rechnet, muss den Kontext mitgeben** (sonst Standard und abweichende Zahlen). SQL-bereit/„fehlt“ nur über `salesBereit`/`fehltBisSqlZeile`/`mqlErreicht` (leads.ts), nie mehr `sqlBereit(kriterien)` direkt (bleibt als Rückfall für Deal-Kopien). Akte/Seitenfenster: `leadZeileFuer`.
- **Standard = geschärfter Vorschlag** (seit 03.10., Kevin: „sofort übernehmen“): `standardScoring()` — Marketing 8, Sales 28, Muss-Regeln, Temperatur 5/12/25; wer nichts gespeichert hat, rechnet damit (`standardZumRechnen`). Die alte Rechnung ist `bisherigeRechnung()` (Etikett `bisherig`, in den Einstellungen als „Bisherige Rechnung (bis 03.10.)“ wählbar; API `aktion: 'bisherig'`); der Paritätstest `tests/scoring-standard-paritaet.test.ts` läuft gegen sie (Fixture `tests/fixtures/lead-score-vor-scoring.ts`). `vorschlagScoring()` gibt es nicht mehr.
- **Begriffe (Kevin 03.10.): Lead → MQL (NUR aus dem Marketing) → SQL.** MQL setzt Marketing-Herkunft voraus — Kampagne, Newsletter mit Double-Opt-in, Website-Anfrage, Content, Anmeldung zu eigenem Event; entschieden von EINER Funktion `istMarketingLead`/`marketingHerkunft` (`lib/crm/scoring.ts`, steckt im Kern: `ScoringErgebnis.marketingLead`, `SeitenErgebnis.gilt`). Begegnung/besuchtes Event, Empfehlung, Direktansprache, Recherche, Bestand bleiben „Lead · noch zu qualifizieren“, bis die Qualifizierung (Sales-Scoring + Muss) SQL entscheidet. Neue Stellen, die MQL zählen oder zeigen, fragen diese Funktion (bzw. `mqlErreicht`/`SeitenChip`), nie die Marketing-Schwelle allein. `ScoringKontext` trägt dafür auch `kampagnen` (`scoringKontext(crm)`).
- **Einstellungen:** Bestand `crm-scoring` (`lib/crm/scoring-server.ts`, Stand = Fingerabdruck, 409; `ladeCrm()` hängt sie als `crm.scoring` an, nie mit dem CRM gespeichert; ETags von bestand/lead/marketing/kampagnen enthalten `crm-scoring`). Route `/api/crm/scoring` (Dienstweg nur lesen). Prüfen/säubern `scoringPruefen`/`scoringSaeubern` (nie kürzen, 400/413 mit Pfad). Editor-Hilfen `scoring-bearbeiten.ts`, Wirkung `scoring-vorschau.ts`.
- **Lead:** optional `stufen` (Frage → Stufe), `wiedervorlage`, `grundArt` (`lead-grund.ts`), `hauptKontaktId` (fällt bei Art. 17/Zusammenführen in `person-verweise.ts` mit); `/api/crm/lead` neue Aktionen `parken`, `raus`, `abgeben`, `firma-folgen(-vorschau)`, `firmen-zusammen(-vorschau)` (nie Dienstweg, Bau-Kennung).
- **Firma wechseln/zusammenführen:** rein `lib/crm/firma-umhaengen.ts` (Vorschau = Schreiben), Server `firma-umhaengen-server.ts` über das Absichtsprotokoll (Art `firma-umhaengen`, Abbruch nach jedem Schritt getestet). Die Station ändert weiter die Kartei-Route (`firmaWechsel`). Zusammenführen lehnt ab, solange außerhalb von Kartei/CRM etwas an der Firma hängt (409 mit Bestandsnamen), Art. 18 → 409. **Seit 03.10. Sicherung zuerst:** Schritt `archiv` schreibt `archiv/crm-vor-firmen-zusammenfuehren-<zeit>.json` (verschlüsselt, 30 Tage über die Löschfrist `archiv-umzug`, Art. 17 über `archivTilgen`); Zurück über `POST /api/crm/firma-archiv` (nur Inhaber, Dienstweg 403, nur was seitdem unverändert ist; `firmenArchive`/`firmenWiederherstellen`). Tests: `firma-archiv.test.ts`, `marketing-lead.test.ts`.
- **Runde:** Seitenfenster (`Seitenblatt`, bewusst NICHT in einer `.karte` rendern — deren Transform macht `position: fixed` relativ), Gesprächsmodus, Herkunft (`lib/crm/herkunft.ts`, Dateien nur über `/api/crm/dateien?id=`), `useLeadFragen` (live Score). Tests: `qualifizierung-*.test.ts`, `scoring-*.test.ts`, `firma-umhaengen.test.ts`.

### Lead-Score & Qualifizierungsrunde (27.09.)
- `lib/crm/score.ts`: `leadScore(personen, lead, heute)` → Punkte 0–100, Temperatur kalt/lau/warm/heiß, vier Teile mit Grund; `kanalVon(k)`, `kanalLeistung(zeilen)`. Nie speichern, immer ableiten — wie die Phase.
- Wärme verfällt (28.09., K4): „hat geantwortet“ (12) und „angesprochen“ (8) nach `WAERME_VERFALL_TAGEN` (180) nur noch 5 bzw. 3 — der warme Typ (10) schlägt Abgekühltes. `temperaturLeistung(zeilen)` = SQL-/Gewinnquote je Temperatur (ab `MINDESTMENGE`), Karte in Sales › Auswertung (`KanalLeistungLaden mitTemperatur`).
- `LeadZeile` (`lib/crm/leads.ts`) trägt `score`, `kanal`, `antworten`, `qualifiziertAm`, `ohneBesitzer`; `zuQualifizieren(zeilen, filter)` ist die Runden-Logik, `nichtKalt` filtert die Leads-Liste.
- Reiter `qualifizierung` (`components/os/crm/Qualifizierung.tsx`), Schreibwege über `/api/crm/lead` (`setze` mit `antworten`/`geprueft`, neu `uebernehmen`). Kalte Leads gehören ins Segment `seg-vernetzen` (Kriterium `temperatur`).
