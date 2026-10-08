# Baustand MAKE OS (laufend gepflegt, für alle Claude-Sitzungen)

> Zweck: Jede Sitzung (auch andere Claude-Code-Fenster) sieht hier, was gerade gebaut wird, wo der Stand liegt und was als Nächstes kommt. Online-Stand = `main` auf dem Server; gebaut wird auf `entwicklung`; hochladen NUR auf Kevins ausdrückliches Wort.

## Online
- Server: **`38f88dc0` (07.10. ~18:28)** — Aufgaben v3 (Malin), Inbox 2 + WhatsApp (ohne Einrichtung aus), iCloud je Person, Blöcke ins eigene iCloud, Verbinden-Karten im Kalender, HOI-Befunde, Einwilligung WhatsApp, Telefon-Dubletten. Websites unverändert (alte „Klar“).
- Sicherung `vor-upload-2026-10-07-1618.tar.gz`, Rückweg-Bild `make-os:6b10a5ba` (ALTES-BILD-OK). Platte danach 5,3 GB frei — alte Bilder 70603154/db93e88/5aca6f5 nur auf Kevins Wort löschen.

## Nacht 08./09.10. — Agenten-Bereich + Medien unterwegs + KI-Anbieter (Kevin: „durchziehen die Nacht“)
- **Entscheidungen:** ENTSCHEIDUNGEN_FRAGEBOGEN.md › „Agenten-Bereich — Antworten“, „Nachtrag Bilder und Videos unterwegs“, „Teil 1 nach der Recherche“.
  Recherchen: `AGENTEN_KONZEPT.md`, `research/agenten/{ARCHITEKTUR,MARKT_UX,MODELLE}.md` (Medien + Recht laufen noch → Fragerunde Teil 2).
- **Basis aller Pakete:** Branch `nach-upload` (Probe-Zusammenführung der 6 fertigen Pakete). Nichts davon geht mit dem Freitags-Upload online.
- **Reihenfolge (höchstens 3 Bau-Agenten parallel):** Paket 0 `agenten-vertrag` (läuft) + Paket 6a `ki-anbieter` (läuft) → danach Paket 1 `agenten-kern`,
  Paket 2 `agenten-seite`, Paket 3 `agenten-skills` → Paket 5 `medien` (nach Kevins Antworten Teil 2) → Paket 4 Verdrahtung (ZOE steuert Heads, ZOE ≤ 20 Werkzeuge,
  Streaming) erst nach dem Merge von 1–3.
- **Befunde für alle:** Register Anthropic SCC statt DPF (in 6a) · Modellstufen Haiku/Sonnet/Opus 5.5 nach Eval-Vergleich (in 6a) · ZOE hat ~66 Werkzeuge (Paket 4).
- **Stand 09.10. ~01 Uhr:** Paket 0 fertig (`agenten-vertrag` a7919902, Basis nach-upload; C11 = Datei-Zuordnung). Laufen (4, Kevin: „90 % Last, ich gehe
  pennen“): `ki-anbieter` (6a), `agenten-kern` (1), `agenten-seite` (2), `medien` (5). Danach `agenten-skills` (3), dann Paket 4. Morgens: Integration
  `agenten-nacht` (Merge 1 → 3 → 5 → 2 → 6a), volle Suite, Demo-Bau, Rundgang mit Bildern, Bericht an Kevin.
- **Aufgaben für Kevin (aus Teil 2):** externen Datenschutzbeauftragten benennen · Anwalt prüft RECHT.md Teil 9 (12 Punkte) · Aufbewahrung im Anthropic-DPA
  schriftlich klären · Hetzner Object Storage anlegen (Medien) · Google-Cloud-Projekt + Vertex-Dienstkonto EU (KI-Anbieter).

## Stand 08.10. spät (auf `entwicklung`, 135 Commits vor `origin/main`, nicht online — Upload Fr 09.10. auf Kevins Wort)
- **Gemergt seit dem Abend:** Teil 3 (`finanzplan-blaetter`, `privat-raus-koerper`, `privat-raus-nordstern` — `lib/make-one/health-data.ts` gelöscht) ·
  `onboarding-b0` + `onboarding-fix` (76 Schritte, Samstag-Kern ≈ 7¾ h, ehrliche Prüfungen) · `vor-upload-datenschutz` (ZOE-Grundauftrag ohne Persönliches,
  Tageslauf/Arbeitsmodus/Gesundheitszeit je Person, Stammdaten serverseitig getrennt, `public/finanz-dashboard.html` raus) · `markttraktion-sofort` (2994fca6:
  10 Funde aus `MARKTTRAKTION_BEFUND.md` — neue Kontakte nicht kalt, Absender früh geprüft/GmbH-Vorgabe, Rechnung brutto, Power Hour schließt Follow-ups,
  Heads im Takt).
- **Volle Suite:** 475 Dateien / 6.116 Tests — 1 Zeitgrenze unter Last (netzwerken-korrektur › 5) auf 20 s angehoben (5cbee0fe); tsc 0.
- **Entschieden (R1–R10, `ENTSCHEIDUNGEN_FRAGEBOGEN.md`):** Onboarding Sa 10.10. ein langer Tag · Stichtag 01.10. · Verantwortlicher MAKE Innovation GmbH ·
  Zulieferer aus (Altbestand-Übernahme `MAKE_OS_ALTBESTAND_PERSON` statt Zulieferer-Schlüssel) · Malin zweite Inhaberin mit SSH (Update 2, 16.10.).
- **Fertig auf Branch, erst NACH dem Freitags-Upload mergen:** `konten-register` (60c52c84; Lücke 2 — EIN Register `konten--<haushalt>`, Rückfall
  bit-gleich, Übernahme nur Vorschau → Bestätigen, Rückweg-Spiegel in `finanzplan.firmen`; KONTEN_REGISTER.md).
- **Fertig auf Branch (nach dem Upload mergen):** `business-frei` (a6873dc4; Lücke 7 — EINE Regel `lib/arbeitsrahmen/regel.ts`, Kalender 409 + Rückfrage,
  freie Zeit/Buchung ohne Plätze, Kapazität, ZOE/Heads ruhen + holen nach, Glocke sammelt).
- **Fertig auf Branch (nach dem Upload mergen):** `rechnungen-pdf` (2021914b; Lücke 4 — Stellen mit lückenloser Nummer + PDF + SHA-256, § 14 UStG
  Pflichtangaben 409, Stornorechnung, Angebot → Rechnung, Mandat → Monatsentwurf, Mahnstufen nur Vorschlag, Route `/api/rechnung`).
- **Fertig auf Branch (nach dem Upload mergen):** `inbox-teilen` (26e8f7f4; Lücke 6 — Übergeben als freigegebene Kopie, Team-Postfach (IMAP + Business)
  mit „wer kümmert sich“, Suche über die eigenen Spiegel; Filterstelle `postfachSichtbar`).
- **Fertig auf Branch:** `zoe-whatsapp` (aca975f7; Lücke 5 — eigene ZOE-Nummer `WHATSAPP_ZOE_*`, Kanal je Person mit Code + Einwilligung, EIN Sendeweg
  `anPersonMelden` (WhatsApp → Telegram → Glocke), Eingang über `/api/kimmi` mit `fremd()`, „Aufgabe:/Notiz:“ nur Vorschlag, „ja <Kennung>“).
- **Probe-Zusammenführung `nach-upload`** (Worktree im Scratchpad): konten-register + business-frei + rechnungen-pdf + inbox-teilen + zoe-whatsapp, Konflikte
  gelöst (UPDATES, Imports, Lese-Bereiche, Markttraktion-Takt = Boten-Kanal UND Business-frei). Volle Suite vor zoe-whatsapp 6.239/6.240 (Test-IBAN behoben,
  84235d62); danach tsc 0 + betroffene Tests grün. → nach dem Freitags-Upload so in `entwicklung` mergen.
- **Fertig auf Branch:** `zulieferer-aus` (1703ec77; Lücke 10 — Schalter `zuliefererLage` (Umgebung > Einstellung > Übernahme > Altbestand > neu aus),
  Erinnerungen → Aufgaben nur Inhaber mit Vorschau/Bestätigen (Absicht `erinnerungen-uebernahme`, `ar-…`), `/api/zulieferung` 410, `vv-mac-m365` archiviert,
  `scripts/mac-zulieferer-entfernen.sh`). In `nach-upload` zusammengeführt (Verzeichnis-Optionen kombiniert), tsc 0; volle Suite auf `nach-upload`
  (6 Pakete): 486 Dateien / 6.326 Tests grün.
- **Recherche fertig:** `AGENTEN_KONZEPT.md` (fb9b4639) — Bestand, Markt mit Quellen, Zielbild, Bauplan (Paket 0 Vertrag → agenten-kern · agenten-seite ·
  agenten-skills → Paket 4 ZOE steuert Heads). Wartet auf Kevins Antworten im Agenten-Fragebogen.
- **Fragen für die nächste Klickrunde (Zulieferer):** (1) Sicherungs-Abholung auf den Mac behalten? (2) Übernahme schaltet den Zulieferer gleich aus — oder
  eigener Klick? (3) `~/.make-os/zulieferer.env` mit dem Dienstschlüssel löschen, danach `MAKE_OS_KEY` rotieren und `MAKE_OS_ZULIEFERER=aus` fest setzen?
  (4) `vv-mac-m365` (auch M365, nicht angebunden) archivieren — ok?
- **Fragen für die nächste Klickrunde (ZOE auf WhatsApp):** (1) Inhalt der Montags-Wochenstart-Nachricht? (2) Sicherheits-Hinweise ohne Boten in die Glocke?
  (3) Glocken-Erinnerungen über WhatsApp freischalten? (4) Eigene Meta-App für ZOE (Webhook je App) — bei Meta prüfen. (5) Telegram behalten oder abschalten?
  (6) Transkription: welcher EU-Dienst? (7) Sprachnachrichten 30 Tage, höchstens eine Vorlage je 20 h — so lassen?
- **Fragen für die nächste Klickrunde (Inbox teilen):** (1) Erledigt/Gelesen im Team-Postfach für alle oder je Person? (2) Screener im Team-Postfach gemeinsam?
  (3) ZOE/Tageslauf der zweiten Person sehen Team-Postfächer (Kopf + Ausschnitt), keine Übergaben — ok? (4) Antwort auf Übergabe nur aus derselben Gesellschaft?
  (5) Lagebild zählt Team-Gespräche nur bei der zuständigen Person? (6) WhatsApp Erledigt/Später ganz gemeinsam? (7) Eigener VVT-Eintrag für Übergaben/Team-Postfach?
- **Fragen für die nächste Klickrunde (Rechnungen):** (1) Nummernformat je Gesellschaft einstellbar (heute `{KURZ}-R-{JAHR}-{NR4}`, mit Steuerberater
  abstimmen)? (2) Versand später über die Inbox statt Mail-Programm? (3) Entwürfe einer gelöschten Person (Art. 17) automatisch entfernen? (4) Geschäftsführung +
  Registergericht bei GmbH/UG als Pflichtangabe — so lassen?
- **Demo-Rundgang 08.10. spät:** 9 Bilder an Kevin; Funde behoben: Tagesplanung „Reha“ fest für alle (2a2ad831), Gesundheit „dem Boten sagen“ (afaf2ddc).
- **Fragen für die nächste Klickrunde (Konten-Register):** (1) Finanzplanung startet MAKE/KD Ventures nach der Übernahme ab dem jüngsten Register-Stand
  (KD Ventures statt „Start KD Ventures“ aus den Annahmen) — so bestätigen? (2) Rücklage im Privat-Index = Summe der Tagesgeld-Konten (privat + gemeinsam)
  oder ein eigens markiertes Konto? (3) Haushalts-Konten und Register-Konten zu EINER Liste zusammenlegen (nächster Schritt)?
- **Fragen für die nächste Klickrunde (Business-frei):** (1) Sperrt Business-frei auch die Selbstständigkeit (Privat, zählt aber als Arbeit)? (2) Sollen
  Ziehen/Verschieben bestehender Business-Termine und Planen-Blöcke ins Fenster auch fragen? (3) Standard „So ganz, werktags ab 20 Uhr“ in neuen Instanzen
  sofort durchsetzen (heute erst, wenn die Familie einmal geöffnet wurde)? (4) Eigene Ergänzung für Konten „nur Business“ in der Oberfläche?
- **Wartet auf Kevin:** Markttraktion-Fragebogen (23 Bereiche, Marktvorbilder, ohne Grenze) · Bank-Runde (B1–B4, S1, K-Paare) · Teil 2 (Business).
- **Vor dem Upload:** Demo-Rundgang mit Bildern (Demo-Bau `.next-demo`, Port 3200) · dann Push auf Kevins Wort · Server-Schritte `UPLOAD_0810.md`.

## Stand 08.10. abends (auf `entwicklung`, nicht online)
- **Phase 0 gebaut + gegengeprüft + gemergt** (6f045180, d25231cd): eigene Ziele nur geteilt lesbar (überall, inkl. Meilensteine daran) · Familie › Vision nur
  eigene Träume · Agenten-Log je Person (`laufPerson`) · WHOOP ist die Quelle (Export-Werte `whoop-export`, Handwerte bleiben) · Freigaben-Reiter „Protokoll“
  (`/os/stapel/voll` leitet weiter), „Ändern & freigeben“ liest deutsche Zahlen · Update-Hinweis oben (`<daten>/system/update.json` aus `deploy/ausrollen.sh`,
  wirkt verlässlich erst ab dem übernächsten Update).
- **Volle Suite:** 465 Dateien / 5.927 Tests — 1 wackliger Test (whoop-route, Hintergrund-Abgleich des Vortests) behoben (9c8a686f); tsc 0, Lint 0 Fehler.
- **Modul-Landkarte** `MODUL_LANDKARTE.md` (im Code geprüft, Online-Stand = `origin/main`; lokaler `main` ist veraltet!). Befunde: Gesundheit › Körper mit
  echten Gesundheitsangaben fest im Code (für alle Konten sichtbar) · Telegram wirkt online nicht (Bote nur am Mac) · Vault-Abgleich läuft nicht (Stand 25.09.) ·
  Brain-Regeln/Inbox fest kevin/malin.
- **Fragebogen:** Teil 1 beantwortet (`ENTSCHEIDUNGEN_FRAGEBOGEN.md`, in ROADMAP_Q4 eingearbeitet) · Teil 2 (Business) gezeigt, Antwort offen · Teil 3
  (Privat & Plattform, inkl. Finanzplan-Blätter-Vorschlag und 5 kleine Entscheidungen aus dem Bau) liegt bereit.
- **Offen aus Phase 0 (Teil 3, Frage 11):** Träume/Dates einer gelöschten Person · WHOOP-Export gleicher Altwert · Aufgaben an privaten Ziel-Meilensteinen ·
  „Sauber geblieben“. Außerdem: `lib/brain.ts` MILESTONES-Rückfall enthält noch den Altnamen „KD Management UG“ (Plattform-/Namensverstoß).

## Auf `entwicklung` (lokal fertig, wartet auf Upload — Stand 07.10. spät)
- Alles bis `38f88dc0` ist online; die frühere Liste hier war damit erledigt.
- **Messlatte M3 „Malin“** — `tests/messlatte-malin.test.ts` (a83f1b72): Malin sieht keine `scope: privat`-Notiz von Kevin (auch nicht den Dateinamen) und keinen der sechs 🔒-Speicher; Frist 31.10. damit nachgewiesen. Offen für Kevin: Routinen-Planer (Gesamtansicht zeigt beiden alle Routinen) und Ernährung (gemeinsam, inkl. Profile) — so lassen oder für Malin ausblenden?
- **0-Punkt (Eröffnung) je Business-Gesellschaft** — Merge `nullpunkt` (9fddf7b1). Kevin 05.10. „geht VOR dem Upload online“ — beim Upload 07.10. vergessen.
- **Websites v3 „Der Weg“** — Merge 49fccef6 (Ruhe-Prüfer v3, Doku). Prüfer 0 Fehler, nur Platzhalter: Datenschutz-Angaben + Kevins Gründer-Satz. Kevin bestätigt Texte vor dem Upload.
- **Zeitstrahl „Seil“ 5/5** — d62fa216 (als ein Commit zusammengefasst, damit der versehentlich eingecheckte Sandbox-Bau aus dem Zwischenstand nicht in die Historie kommt). Offen: Zeilen der Spalte 22 px (Tablet-Touch < 44 px), Ziel-Kopf 12 px/Untertitel gegen den Design-Standard.

## Kevins Entscheidungen 08.10. (Klickrunde) — zu bauen bzw. beim Upload umzusetzen
**Website (makeinnovation.de):** AVV Hetzner ✔ · AVV Google ✔ · Drittland-Verträge (Google, Microsoft, Apple, Anthropic) ✔ → diese Platzhalter löschen ·
Login-Abschnitt verlinkt den Datenschutzhinweis der App (app.makeinnovation.de) · Abschnitt „Geschäftskontakte und Veranstaltungen“ vorerst RAUS (bis Anwalt; Verweis
unter „Weitergabe“ mit raus) · Impressum/Verantwortlicher: „KEMARIS Innovation GmbH, vertreten durch Kevin Dieckmann“ · Gründer-Satz: Platzhalter bleibt (Kevin schreibt selbst)
→ Website erst online, wenn der Satz da ist.
**Malin:** Routinen-Planer: Routinen der anderen Person nur als „Belegt“ (ohne Titel), serverseitig; gemeinsame voll · Ernährung: Plan/Einkauf/Gerichte gemeinsam,
Profile (Bedarf/Ziel) nur die Person selbst — außer sie teilt Gesundheit. Wächter in tests/messlatte-malin.test.ts ergänzen.
**Eigentum MAKE OS:** Weg B — Einbringung in die GmbH (nur im Vault festhalten; Anwalt/Steuerberater klären Bewertung).
**Vault:** Notizen im „01. MAKE OS Brain“ bekommen oben einen Block „🔴 UPDATE 08.10.“ mit dem echten Stand (nichts löschen).
**Upload:** erst bauen, zeigen, dann auf Kevins Wort. Dabei: 2FA-Pflicht an · Pepper + MAKE_OS_START_RIEGEL=streng setzen · Zulieferer-Schlüssel umstellen ·
`_App`-Spiegel an (MAKE_OS_APP_SPIEGEL=an) · Vault-Abgleich per Git einschalten (ohne Privates) · alte Bilder 70603154/db93e88/5aca6f5 löschen (6b10a5ba bleibt).
**Danach:** Format v2 umstellen, wenn der neue Stand stabil läuft.
**Bleibt so / offen:** Selbstständigkeit in Business-Index/Cockpit/Steuern/Liquiplan wie heute · Design Klar·DARK bleibt (erledigt) · Zielgruppe Produkt: offen.

## Stand 08.10. nachmittags
- **ONLINE geändert (Kevin, Hotfix `1de19d8c` auf `main`, Caddy neu geladen):** makeinnovation.de + fokusinnovation.de sind OFFLINE (503, ohne Inhalt).
  App app.makeinnovation.de läuft unverändert. Derselbe Offline-Stand ist in `entwicklung` gemergt (afe161a2), damit ein Upload sie nicht still einschaltet.
- **Websites lokal:** KEMARIS überall raus (Absender nur „MAKE Innovation“, hello@makeinnovation.de, ohne Telefon, § 18 MStV Kevin Dieckmann);
  offen: Registerangaben (Platzhalter bis zur Eintragung der Umbenennung) · fokus „Teilnahme an einem Abend“ (Anwalt). Wieder online: siehe website/LIESMICH.md.
- **Gemergt:** `malin-sicht-2` (Essensvorschläge personenneutral, Lese-Protokoll Ernährung, fremde Wochenblöcke „Belegt“) · `sicht-pruefung` (8 Lücken
  geschlossen, Messlatte prüft alle GET-Routen gegen 26 Geheim-Marken). Volle Suite 452 Dateien / 5.751 grün.
- **In Arbeit:** Whoop je Person (Branch `whoop`, Agent) — Verbindung je Person, alle Daten, Webhook/Takt, Art. 9. Danach braucht es Kevin ~15 Min. (Whoop-App).
- **Fragen an Kevin aus der Sicht-Prüfung (offen):** eigene Ziele per `?fuer=` lesbar? · Agenten-Log je Person trennen? · Familie › Vision nur eigene Träume
  ändern? · Ernährungs-Wochenplan nutzt Kevins Unverträglichkeiten ohne „teilt Gesundheit“? · Malin darf in Kevins nicht-private Kalender schreiben? ·
  Archiv-Blöcke des alten Wochenplans „Belegt“? · Variante „für eine Portion ohne X“ ok?

## Stand 08.10. mittags (auf `entwicklung`, nicht online)
- Gebaut nach Kevins Entscheidungen: Websites (Datenschutz/Impressum, nur Gründer-Satz offen; fokus: „Teilnahme an einem Abend“ wartet auf Anwalt) · Malin-Sicht
  (Merge `malin-sicht`: fremde Routinen „Belegt“, Ernährungsprofile nur selbst, Schreiben auf Fremdes 403) · Vault: 17 Notizen im MAKE OS Brain mit Block
  „🔴 UPDATE 08.10.“ unter dem Titel, alter Text unter „Verlauf“ · `UPLOAD_0810.md` = Schritte für den Upload · demo.test mit echtem Datum.
- Prüfung: volle Suite 449 Dateien / 5.729 Tests grün, tsc 0, Lint 0.
- Offen (Kevin): Gründer-Satz · Postgres oder JSON (M4) · Wiederherstellungstest · Ernährungs-Varianten „für <Name> ohne …“ erlaubt? · Blöcke der Wochenvorlage
  zeigen Titel beiden · Lese-Protokoll für Ernährungsprofile.

## Aufräumen (wartet auf Kevin — Löschen braucht sein Wort)
- Worktrees bereits gemergter Branches unter `.claude/worktrees/` (nullpunkt, betroffenenrechte, finanzplan-5, icloud-je-person, inbox-2, aufgaben-struktur, whatsapp, inbox-whatsapp-ui, websites-v3, zeitstrahl-seil) — `git worktree remove` je Ordner; Branches bleiben.
- `worktree-agent-a726d126d4270b431` (Kalender-Gesamtprüfung 29.09.) ist überholt: alle Korrekturen stehen schon in `entwicklung`.
- `websites-klar-2` steckt vollständig in `websites-v3`. `fokus-3d` bleibt geparkt (Kevin: Richtung geändert).

## Als Nächstes
1. Volle Suite → Prüfbau + Browser → Kevin zeigen → Upload auf Wort
2. Vault-Notizen im MAKE OS Brain auf den Stand bringen (viele tragen nur oben ein Update-Banner, Text darunter vom 26.09.) — nur mit Kevins Wort

## Regeln (Kurz)
8 GB RAM: max. 2 schwere Agenten, vitest `--maxWorkers=2`, nie Bau parallel zu Tests · nie `.data/` · ZOE nur Vorschlag · Bereichstrennung serverseitig · alles belastbar (Primärquellen).
