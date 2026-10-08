# MAKE OS — Plan bis Mitte Q1 2027 (verbindlich, Stand 08.10.2026)

> Entstanden aus Kevins 50 Antworten am 08.10.2026 (Klickrunde). Dieses Dokument ist die Wahrheit; das Bauplan-Board in der App
> (`/os/bauplan`, Etappen mit Zieldatum) ist die Arbeitsliste dazu. Änderungen am Plan nur auf Kevins Wort — dann hier nachtragen.
> Gilt zusammen mit CLAUDE.md (Regeln) und BAUSTAND.md (Tagesstand).

## Leitbild
- **MAKE OS wird der „AI CEO“** für **Business Couples, Solopreneure und kleine Mittelständer** — ein Chief of Staff, der alles kennt,
  vorschlägt und vorbereitet; der Mensch gibt per Klick frei. Wie autonom ZOE handelt, ist **je Kunde einstellbar** (Standard: nichts ohne Klick).
- **Kernmerkmal: zu zweit arbeiten** — zwei Personen, ein Haushalt, gemeinsame Firma(n), klare Privat-Grenzen (serverseitig).
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
- **Kevin:** WHOOP-App anlegen (Redirect `…/api/whoop/rueckruf`, Webhook `…/api/whoop/webhook`, v2) · nach dem Upload die GmbH-Zahlen (0-Punkt) eintragen.

## Phase 1 — Eigennutzung polieren (12.10. – 31.10., Updates jeden Freitagnachmittag: 16.10., 23.10., 30.10.)
- In dieser Reihenfolge feinjustieren: **Heute & ZOE** → **Aufgaben & Kalender** → **Inbox & Markttraktion** → **Finanzen**.
- **Verbindungen live:** Google Workspace (Business-Kalender + Gmail makeinnovation.de), WHOOP je Person.
- **KI-Verbrauch messen** (einen Monat), danach Monatsgrenze festlegen (Head of IT warnt).
- **Malins Start 01.11.** vorbereiten: Konto, 2FA, Einwilligungen, Onboarding (`ONBOARDING_MALIN.md`); sie nutzt alles.

## Phase 2 — November: Malin an Bord, Bank, Handy, Datenschutz für Kunden
- Feinjustierung nach Malins Rückmeldungen (Melden-Knopf → Bauplan).
- **Bank-Anbindung über finAPI** (lizenzierter PSD2-Dienst, Einwilligung je Konto, 90-Tage-Erneuerung) → Buchungen automatisch.
- **Handy:** Web-App (Homescreen) polieren, Sprache mit ZOE stärken; native App später.
- **Datenschutz-Paket für Kunden (höchster Standard, keine Fehler):** AVV auf Basis einer anerkannten Vorlage (z. B. Bitkom/GDD) angepasst,
  TOM-Liste aus dem echten System, Unterauftragnehmer-Liste, Verzeichnis je Instanz, KI-Standard „sparsam“ (Hintergrund-KI aus,
  Kunde schaltet frei, auch ganz ohne KI startbar), Löschkonzept, Instanz-Trennung geprüft. Anwaltliche Prüfung vor dem ersten Kunden.

## Phase 3 — Dezember: Instanz-Fabrik + Generalprobe
- Kunde einrichten **wie ein echtes Onboarding**: eigene Instanz auf Hetzner Deutschland (eigener Container, Datenordner, Schlüssel),
  **eigene Domain des Kunden**, Datenschutz-Einrichtung, leeres Onboarding, Business-Couple-Setup, KI-Budget je Instanz, Autonomie-Regler je Kunde.
- **Feedback-Brücke:** „Melden“ in der Kundeninstanz landet ohne Kundendaten in eurem Bauplan.
- Generalprobe mit einem erfundenen Demo-Kunden.

## Phase 4 — Januar: 3–5 Testkunden
- Onboarding, Betreuung durch **Kevin + Malin + ZOE** (Erstfragen im Tool), **wöchentlicher Feedbacktermin** + Melden-Knopf.
- Messen: tägliche Nutzung, Zeitersparnis, Zahlen, Weiterempfehlung.

## Phase 5 — ab Mitte Februar 2027: mitverkaufen
- Preis und Name entscheiden (nach Testkunden-Feedback), Websites neu ausrichten und wieder online.

## Arbeitsweise (ab jetzt)
- **Plan = dieses Dokument + Bauplan-Board.** Neue Wünsche kommen in den Plan, nicht nebenher.
- **Rückfragen 1× täglich gesammelt als Klickrunde.** Bei offenen Fragen wird das betroffene Paket **geparkt** bis zur Antwort;
  Claude lernt aus den Entscheidungen (Entscheidungs-Log) und übernimmt mit der Zeit mehr selbst, wenn Kevin das freigibt.
- **Updates jeden Freitagnachmittag**, gesammelt; Claude pusht auf Kevins Wort, prüft den Server und meldet das Ergebnis.
- Bauen auf `entwicklung`, volle Suite + Sichtprüfung (Demo-Instanz) vor jedem Update; Mac-Last ≤ 75 % (höchstens 2 Agenten).
