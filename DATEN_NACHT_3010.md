# Daten- und Datenschutzprüfung — Nacht 30.10.2026

Branch `nacht-daten` (Basis fb82c8c2). Schwerpunkt: alles seit 20.10. (Prozesse/Werkstatt/Fulfillment, Kreislauf Geld, Rechnungen,
Formulare/öffentliche Strecken, Social, weitere Google-Konten, große Akten). Maßstab: CLAUDE.md. Hinweis, keine Rechtsberatung.
Wächter für alle Funde: `tests/daten-nacht-3010.test.ts`.

## Funde (behoben)

| # | Fund | Schwere | Dateien | Behebung | Test |
|---|------|---------|---------|----------|------|
| 1 | Frist der Instagram-Kommentare/DMs (180 Tage) wirkte nur beim Abholen eines **verbundenen** Kanals; Frist der Formular-Eingänge (24 Monate) nur beim nächsten Schreiben. Getrennter Kanal, entfernte App oder ruhendes Formular → Daten Dritter blieben unbegrenzt (Art. 5 Abs. 1 lit. e). | mittel | `lib/social/community.ts`, `lib/crm/formulare-speicher.ts`, `lib/crm/loeschfristen-lauf.ts`, `lib/crm/speicher-register.ts` | EINE reine Regel `communityFrist` (Einträge, Fäden ohne Eintrag — ihr Schlüssel trägt die Kennung des Gegenübers —, Entwürfe, erledigte Fremd-Entwürfe) für Abholen UND Löschfristen-Lauf; `formularFristAnwenden` im Lauf (Schritt 11b3). Idempotent, legt nichts an. | Fund 1 |
| 2 | Social-Modul (Instagram über Meta, LinkedIn) fehlte im Verzeichnis (Art. 30) und die Plattformen fehlten im Empfänger-Register (Art. 28/44). | mittel | `lib/crm/datenschutz.ts`, `lib/datenschutz/einrichtung.ts`, `lib/social/anbieter/index.ts`, 3 Aufrufer von `verzeichnisVervollstaendigen` | Verarbeitung `vv-social` (nachgetragen, sobald ein Anbieter eingerichtet ist — `socialEingerichtet`); Empfänger `meta-instagram`, `linkedin` (archiviert bis zum Verbinden, Rolle „gemeinsam“, Garantie „zu prüfen“), in gespeicherte Listen nachgetragen. | Fund 2 |
| 3 | Kontakt-Auskunft (Art. 15) zählte Check-Sitzungen, Formular-Eingänge und Social-Einträge der Person, nannte aber deren Verarbeitung (Zweck, Grundlage, Frist, Empfänger) nicht. | niedrig–mittel | `lib/datenschutz/art15.ts` | `kontaktBereiche`/`KONTAKT_JE_BEREICH`: `check`, `formular`, `social`. | Fund 3 |
| 4 | Dubletten zusammenführen ließ `Rechnung.kontaktId`, `Eingang.kontaktId` (Angebot anfordern) und `CheckSitzung.crm.kontaktId` auf die gelöschte Person zeigen — die behaltene Person verlor ihre Rechnungen in Akte, Umsatz-Sicht und Art.-15-Auskunft (`rechnungenAuskunft`). | mittel | `lib/crm/person-bestaende.ts` | `personenUmbiegen` biegt genau diese Felder um (Rechnung selbst, Empfänger-Momentaufnahme und PDF unverändert); idempotent. | Fund 4 |
| 5 | Konto löschen tilgte den Speichernamen nicht in `social-community--*` (`durch`, Fremd-Entwurf `von`), `social-werkstatt--*` (`von`, `geaendertVon` — das Register versprach es) und `social-lauf--*` (`von`). | niedrig–mittel | `lib/social/community.ts`, `lib/social/werkstatt/regeln.ts`, `lib/datenschutz/konto-daten.ts` | `communityOhnePerson`, `werkstattOhnePerson`, Lauf-Stand im Konto-Löschen; Einträge bleiben, Name → „[gelöscht]“. | Fund 5 |

## Geprüft ohne Befund

- Speicher-Register: alle neuen Bestände eingetragen (Wächter grün), mit Angaben wo Personenbezug; `PERSON_BESTAENDE`/`NICHT_PERSOENLICH` für `google-zusatz--*`, `kalender-google-zusatz--*`, Social, Prozesse, Formular.
- Art. 17 (`WEITERE_SPEICHER`): Check, Formular, Social, Webhook-Eingänge, Prozess-Läufe, Fulfillment abgedeckt.
- Löschfristen: Check-Sitzungen, Webhook-Eingänge, Prozess-Läufe, Medien-Links im Morgenlauf bzw. Takt.
- Trennung serverseitig: Routen-Register und Messlatte (alle GET mit fremder Sitzung) grün; Scores (`scoresFuer`), Rechnungen (`inSicht`, Selbstständigkeit nur volle Mitglieder), Social (`socialFuerPerson`), Community-Fäden nur sichtbarer Kanäle.
- Öffentliche Strecken (`/api/angebot/<slug>`, `/api/check`, Prozess-Webhook, Social-Medien-Link): eine Antwort je Fehlerart, Drossel, Honigtopf/Stempel, Größe, Schlüssel nur als Fingerabdruck, zeitkonstant.
- Verbindungsprüfung Rechnungen (`rechnung-bezug-tot` u. a.); Firmen zusammenführen blockt bei Verweisen im Finanzplan (409).
- Geld: keine eigenen USt-Rechnungen neben `lib/finanzen/ust.ts`; `localDay`-Wächter (repo-sauber) grün.

## Offen für Kevin

1. **Mandat aus Angebot automatisch** (`lib/crm/mandat-automatik-server.ts`) schreibt nacheinander CRM, Kartei, Liquiplan und `rechnungswesen` ohne Absichtsprotokoll. Bricht es mittendrin ab, bleibt das Mandat ohne Liquiplan-Posten und ohne Rückgängig-Merker (kein Datenverlust, aber „Rückgängig“ fehlt). Empfehlung: Absicht-Art `mandat-automatik` mit Fortsetzer.
2. **Prozess-Läufe beim Zusammenführen:** Läufe zu einem Lead (Person) tragen die Kennung im Fall/Schlüssel; beim Zusammenführen wird nicht umgebogen (nur im Kennungs-Umzug). Bewusst nicht angefasst — „ein offener Lauf je Schlüssel“ könnte sonst doppelt werden. Entscheidung nötig.
3. **Verzeichnis „Prozesse/Automationen und Webhook-Eingänge“** fehlt als eigene Verarbeitung (Eingänge Dritter über Webhooks). Heute nur über die Fach-Verarbeitungen gedeckt — anwaltlich klären, ob eigener Eintrag.
4. **Rolle der Plattformen** (Meta/LinkedIn: eigener Verantwortlicher bzw. gemeinsam für Insights) und DPF-Teilnahme sind „zu prüfen“ eingetragen — bitte gegenlesen und die Vereinbarungen ablegen.
5. Konto-Export: eigene Antworten in Kommentaren/DMs (`durch`) sind nicht im Export der Person (Bestand gilt als „nicht persönlich“). Klein; bei Bedarf ergänzen.
