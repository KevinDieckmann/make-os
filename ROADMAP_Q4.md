# MAKE OS — Plan bis Mitte Q1 2027 (verbindlich, Stand 08.10.2026)

> Entstanden aus Kevins 50 Antworten am 08.10.2026 (Klickrunde). Dieses Dokument ist die Wahrheit; das Bauplan-Board in der App
> (`/os/bauplan`, Etappen mit Zieldatum) ist die Arbeitsliste dazu. Änderungen am Plan nur auf Kevins Wort — dann hier nachtragen.
> Gilt zusammen mit CLAUDE.md (Regeln) und BAUSTAND.md (Tagesstand).

## Leitbild
- **MAKE OS wird der „AI CEO“** für **Business Couples, Solopreneure und kleine Mittelständer** — ein Chief of Staff, der alles kennt,
  vorschlägt und vorbereitet; der Mensch gibt per Klick frei. Wie autonom ZOE handelt, ist **je Kunde einstellbar** (Standard: nichts ohne Klick).
- **Kernmerkmal: zu zweit arbeiten** — zwei Personen, ein Haushalt, gemeinsame Firma(n), klare Privat-Grenzen (serverseitig).
- **Versprechen an Kunden:** „Ihr schafft viel mehr, strukturierter, mit einem Assistenten, der mitdenkt“ — eine Plattform für alles
  (Privat, Business, KI) für KMU und Solopreneure, die wenig Struktur haben; dazu mehr Umsatz durch besseren Vertrieb.
- **Fokus 12 Wochen (Fragebogen Teil 1):** Eigennutzung rund · MAKE OS als Betriebssystem der GmbH · ZOE per Sprache · Bank-Anbindung.
- **Ziele der nächsten 3 Monate:** (1) Eigennutzung Kevin + Malin rund, (2) MAKE OS trägt die MAKE Innovation GmbH,
  (3) **3–5 Testkunden** bekommen ihre eigene Instanz, (4) **ab Mitte Q1 2027 mitverkaufen** (Markttraktion, volles MAKE OS, AI CEO —
  Ziel ist der AI CEO; ein Testkunde bekommt die komplette Software, die bis dahin fertig ist).
- **Erfolg messen an:** tägliche Nutzung · gesparte Zeit · bessere Zahlen · Weiterempfehlung.
- **Bewusst offen (später entscheiden):** Preis, Produktname. KI-Kosten bei Kunden: im Abo mit Monatsgrenze.

## Phase 0 — diese Woche (bis Freitag 09.10., Upload Freitagnachmittag)
- **Upload** des ganzen Stands seit 07.10. (Claude pusht auf Kevins Wort; Schritte `UPLOAD_0810.md`): 2FA-Pflicht, Pepper + strenger
  Start-Riegel, Zulieferer-Schlüssel, `_App`-Spiegel, Vault-Abgleich, alte Server-Bilder weg. Websites bleiben **offline**, bis alles sauber ist.
- **Zweite Sicherung am Mac** einrichten + einmal Wiederherstellung üben (`RESTORE_TEST.md`).
- **Vor dem Upload noch bauen** (Kevins Antworten 08.10.):
  - Eigene Ziele lesbar für den Partner **nur wenn geteilt** (wie Gesundheit, Einstellung im Konto).
  - Kalender: Partner darf in nicht-private Kalender schreiben (**wie eine Assistenz** — bleibt wie heute, im Onboarding erklären).
  - Familie › Vision: **nur eigene Träume ändern**.
  - **Agenten-Log je Person** trennen (System-Läufe gemeinsam).
  - Ernährungsplan nutzt Unverträglichkeiten ohne Namen — **so lassen**; Variante „für eine Portion ohne …“ — **so lassen**.
  - WHOOP: **WHOOP ist die Quelle** (Löschen nur in der WHOOP-App); Werte aus dem alten Export: **Schnittstelle gewinnt** (nur echte Handeingaben bleiben).
  - Finanzen › Planung: Blätter auf **~8 zusammenlegen** (Vorschlag vorher zeigen).
  - „Aufträge & Freigaben › voll“ als **Reiter „Protokoll“** in die Freigaben.
  - **Update-Hinweis** schmal oben auf jeder Seite, solange ein Update läuft.
  - Markttraktion bleibt bei 6 Reitern + 2 Schnellknöpfen.
  - **Fragebogen Teil 3 (08.10. abends):** private Inhalte raus aus dem Code — Körper-Reiter als eigene Daten je Person (sieht nur die Person selbst, an die KI
    nur mit Einwilligung), Nordstern als gemeinsames Ziel in Planung › Jahr, alte Meilenstein-Liste weg, Personen-Sonderfälle (Vitalwerte, Zähler) weg;
    Kevins bisherige Inhalte werden einmalig in seine Daten übernommen (Server-Variable `MAKE_OS_ALTBESTAND_PERSON`), danach aus dem Code gelöscht.
    Finanzplan-Blätter: Privat 9 (mit eigenem Wochen-Check) · Business 6 · Annahmen & Steuern hinter dem Zahnrad. Kleine Entscheidungen: Träume/Dates einer
    gelöschten Person bleiben ohne Namen, WHOOP-Export-Altwert wird überschrieben, Aufgaben an privaten Ziel-Meilensteinen bleiben sichtbar.
- **Kevin:** WHOOP-App anlegen (Redirect `…/api/whoop/rueckruf`, Webhook `…/api/whoop/webhook`, v2) · nach dem Upload die GmbH-Zahlen (0-Punkt) eintragen.

## Phase 1 — Eigennutzung polieren (12.10. – 31.10., Updates jeden Freitagnachmittag: 16.10., 23.10., 30.10.)
- In dieser Reihenfolge feinjustieren (Fragebogen Teil 1, ersetzt die frühere Reihenfolge): **ZOE** → **Planung & Ziele** → **Inbox** →
  **Aufgaben** → **Kalender** → **Brain** → **Mandate & Unternehmen** → **Heute** → **Markttraktion** → **Finanzen**.
  Grundsatz: **nichts entfernen** (ganzheitliche Plattform) — ordnen, verbinden, verständlicher machen.
- **ZOE = Ansprechpartnerin für alles** (Business, Leben, Beziehung, Gesundheit): im Hintergrund alles im Blick, erinnert, warnt vor
  Veränderungen, nimmt ab, was geht. Rhythmus: **7 Uhr Telegram-Briefing**, **Montag Wochenstart**, **Freitag Wochenrückblick**.
  Ohne Klick (nur eigene Instanz): Kontakte anreichern, Erinnerungen per Telegram, Wochenplan-Entwurf anlegen — weitere Ideen vorschlagen.
- **Heute oben:** Top-3 von ZOE · kurzes Tages-Briefing · offene Freigaben · Fortschritt der Jahresziele.
- **Aufgaben:** Vorschläge aus Mails/WhatsApp · Eisenhower sichtbarer · täglich Top-3 · Zeitschätzung + Kapazität.
- **Planung:** alle zwölf Punkte aus Frage 8 (Wochenplanung mit ZOE, Blöcke aus Aufgaben, Kette Ziel→Meilenstein→Aufgabe, Kapazitätswarnung,
  Seil als Hauptansicht, Quartalsplanung zu zweit, Routinen, Fokuszeit, Paar-Planung, Nordstern prominenter …). Antworten: `ENTSCHEIDUNGEN_FRAGEBOGEN.md`.
- **Verbindungen live:** Google Workspace (Business-Kalender + Gmail makeinnovation.de), WHOOP für beide (täglich aktuell).
- **ZOE erreicht euch über WhatsApp** (eigene Business-Nummer, Nachricht an uns selbst) — Telegram wirkt online nicht (Abholer nur am Mac) und ist ein
  Drittland-Dienst ohne AVV. Darüber laufen das 7-Uhr-Briefing, Montag Wochenstart, Freitag Rückblick und Erinnerungen (Kanal einmal bestätigen lassen).
- **Brain:** Notizen direkt in MAKE OS schreiben · ZOE liest Kern-Notizen immer mit (Profile, Projekte, Werte) · Entscheidungen automatisch protokollieren ·
  `_App`-Spiegel an (Upload).
- **Familie/Planung:** Business-freie Zeiten wirklich durchsetzen (Kalender sperrt, ZOE hält sich daran, Kapazität zieht sie ab).
- **KI-Verbrauch messen** (einen Monat), danach Monatsgrenze festlegen (Head of IT warnt).
- **Malins Start 01.11.** vorbereiten: Konto, 2FA, Einwilligungen, Onboarding (`ONBOARDING_MALIN.md`); sie nutzt alles.

## Phase 2 — November: Malin an Bord, Bank, Handy, Datenschutz für Kunden
- Feinjustierung nach Malins Rückmeldungen (Melden-Knopf → Bauplan).
- **Bank-Anbindung über finAPI** (lizenzierter PSD2-Dienst, Einwilligung je Konto, 90-Tage-Erneuerung) → Buchungen automatisch.
- **Handy & Sprache:** Web-App (Homescreen) polieren; Sprachnachricht an ZOE → Aufgabe/Notiz, ZOE versteht Sprachnachrichten (Transkription),
  Siri-Kurzbefehl „Sag ZOE …“; **eigene App** (Kevins Idee) als nächster Schritt danach planen.
- **Gesundheit:** Malin als Gesundheits-Beauftragte mit eigener Rolle (sieht nur Geteiltes) · Training als Blöcke im Kalender · ZOE als Gesundheits-Coach
  (nur mit Einwilligung).
- **Familie:** ZOE schlägt Dates und Gesprächsthemen vor · Urlaub & Reisen planen · gemeinsame Vision jährlich mit ZOE.
- **Datenschutz-Paket für Kunden (höchster Standard, keine Fehler):** AVV auf Basis einer anerkannten Vorlage (z. B. Bitkom/GDD) angepasst,
  TOM-Liste aus dem echten System, Unterauftragnehmer-Liste, Verzeichnis je Instanz, KI-Standard „sparsam“ (Hintergrund-KI aus,
  Kunde schaltet frei, auch ganz ohne KI startbar), Löschkonzept, Instanz-Trennung geprüft. Anwaltliche Prüfung vor dem ersten Kunden.

## Phase 3 — Dezember: Instanz-Fabrik + Generalprobe
- Kunde einrichten **wie ein echtes Onboarding**: eigene Instanz auf Hetzner Deutschland (eigener Container, Datenordner, Schlüssel),
  **eigene Domain des Kunden**, Datenschutz-Einrichtung, leeres Onboarding, Business-Couple-Setup, KI-Budget je Instanz, Autonomie-Regler je Kunde.
- **Feedback-Brücke:** „Melden“ in der Kundeninstanz landet ohne Kundendaten in eurem Bauplan.
- **Demo-Instanz online** zum Vorführen · **Modul-Schalter** (z. B. „nur Markttraktion“) · **feste Kevin/Malin-Stellen vollständig neutralisieren**
  (Ergebnis der Suche nach privaten Inhalten im Code, 08.10.).
- Generalprobe mit einem erfundenen Demo-Kunden.

## Phase 4 — Januar: 3–5 Testkunden
- Onboarding, Betreuung durch **Kevin + Malin + ZOE** (Erstfragen im Tool), **wöchentlicher Feedbacktermin** + Melden-Knopf.
- Messen: tägliche Nutzung, Zeitersparnis, Zahlen, Weiterempfehlung.

## Phase 5 — ab Mitte Februar 2027: mitverkaufen
- Preis und Name entscheiden (nach Testkunden-Feedback), Websites neu ausrichten und wieder online. Vermarktung erst, wenn es intern fertig ist
  (Kevin 08.10.: „Noch nicht — erst intern fertig“). Datenschutz: später Richtung ISO 27001.

## Arbeitsweise (ab jetzt)
- **Plan = dieses Dokument + Bauplan-Board.** Neue Wünsche kommen in den Plan, nicht nebenher.
- **Rückfragen 1× täglich gesammelt als Klickrunde.** Bei offenen Fragen wird das betroffene Paket **geparkt** bis zur Antwort;
  Claude lernt aus den Entscheidungen (Entscheidungs-Log) und übernimmt mit der Zeit mehr selbst, wenn Kevin das freigibt.
- **Updates jeden Freitagnachmittag**, gesammelt; Claude pusht auf Kevins Wort, prüft den Server und meldet das Ergebnis.
- Bauen auf `entwicklung`, volle Suite + Sichtprüfung (Demo-Instanz) vor jedem Update; Mac-Last ≤ 75 % (höchstens 2 Agenten).
- **Seit 08.10. abends (Kevin):** Kleinigkeiten entscheidet Claude selbst nach Kevins Mustern, Bericht hinterher · jede Richtungsfrage als Klickrunde
  (≥ 10 Möglichkeiten, nach Modulen, „Heute gibt es“ aus `MODUL_LANDKARTE.md`) · täglicher Kurzbericht · vor jedem Upload ein Rundgang in der Demo mit Bildern.
