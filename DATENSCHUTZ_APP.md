# Datenschutz in MAKE OS (Anwendung) — Stand 05.10.2026

Arbeitsdokument aus der DSGVO-Prüfung vor dem Upload (Teil 2). **Hinweis, keine Rechtsberatung — einmal anwaltlich gegenlesen.**
Die Website-Erklärung (`website/datenschutz.html`) verweist für `app.makeinnovation.de` auf „einen eigenen Hinweis in der
Anwendung“ — den gibt es noch nicht. Abschnitt 4 ist ein **Entwurf** dafür; veröffentlicht wird er erst auf Kevins Wort.

## 1. Wo was steht (eine Quelle je Thema)

| Thema | Stelle im Code | Wächter |
|---|---|---|
| Register aller Bestände (Personenbezug, Art.-17-Behandlung, **neu: Rechtsgrundlage, Art.-15-Weg, Löschfrist, Kategorie**) | `lib/crm/speicher-register.ts` | `tests/datenschutz-register.test.ts` (neue Speicher MÜSSEN die Angaben tragen; Altbestand ohne Angaben darf nur sinken) |
| Verzeichnis der Verarbeitungstätigkeiten (Art. 30) | `lib/crm/datenschutz.ts` (`verarbeitungenStart`, `…Netzwerken`, `…Kalender/Email`, **neu `verarbeitungenOrganisation`**) — sichtbar unter Markttraktion › Stammdaten › Datenschutz | `tests/netzwerken-recht-server.test.ts` |
| Löschkonzept | `LOESCHREGELN` (dort, **neu: Papierkorb 30 Tage**) + `lib/crm/loeschfristen*.ts` | — |
| Art. 15 (Auskunft Kontakt) | `personAufzaehlen` in `lib/crm/person-bestaende.ts` (**neu: `gesellschaften`**, Papierkorb mit) | `tests/gesellschaften-dsgvo.test.ts`, `tests/besuche-route.test.ts` |
| Art. 17 (Löschen Kontakt) | `personEntfernen` + `lib/crm/person-weitere.ts` (`WEITERE_SPEICHER`) | dieselben |
| **Verantwortlicher, Empfänger/AVV (05.10.)** | `lib/datenschutz/einrichtung.ts` (Bestand `datenschutz-einrichtung`), System › Datenschutz | `tests/datenschutz-einrichtung.test.ts` |
| **Selbstprüfung mit Umfeld (05.10.)** | `selbstpruefung` + `lib/datenschutz/umfeld.ts`, `/api/datenschutz/pruefung` | `tests/datenschutz-selbstpruefung.test.ts` |
| **Verzeichnis vollständig + Export (05.10.)** | `verzeichnisVervollstaendigen`, `lib/datenschutz/verzeichnis-export.ts`, `/api/datenschutz/verzeichnis` | `tests/datenschutz-verzeichnis.test.ts` |
| **Sicherungsfrist (05.10.)** | `SICHERUNG_GENERATIONEN`/`SICHERUNG_SATZ` (lib/crm/loeschfristen.ts) ↔ `deploy/generationen.sh` | `tests/datenschutz-sicherungsfrist.test.ts` |
| **Pannen-Register (05.10.)** | `lib/datenschutz/pannen.ts` (Bestand `datenschutz-pannen`, nur Inhaber) | `tests/datenschutz-zusatz.test.ts` |
| **Bauplan-Bilder (05.10.)** | `lib/bauplan/speicher.ts` (verschlüsselt), `lib/bauplan/bilder-frist.ts` | `tests/bauplan-bilder-dsgvo.test.ts` |

## 2. Neue Verarbeitungen seit dem Online-Stand 5aca6f5

**Gesellschafts-Register** (`gesellschaften--<haushalt>`, `/os/unternehmen`) — Kategorie *vertraulich*
- Zweck: eigene Gesellschaften führen (Steckbrief, Gesellschafter/Cap-Table, Organe, Beschlüsse, Beteiligungen, Verträge, Fristen).
- Personen: Gesellschafter, Organmitglieder, Vertragsparteien — Dritte NUR als Kennung (CRM-Kontakt/-Firma), nie mit Namen im Register.
- Rechtsgrundlage: Art. 6 Abs. 1 lit. c (§ 40 GmbHG, § 257 HGB, § 147 AO), lit. b (Verträge), lit. f.
- Zugang: nur Haushalt des Inhabers (sonst 403); Cap-Table/Verträge nie in der Absender-Antwort; ZOE liest nur Kennungen.
- Art. 15: Kopie der Gesellschafter-/Organ-/Vertragsangaben in der Kontakt-Auskunft (auch Papierkorb/Archiv, markiert).
- Art. 17: Kennung → „[gelöscht]“ überall im Register (auch Papierkorb/Archiv, auch Freitext); Cap-Table und Vertrag bleiben
  (eigene Geschäftsunterlagen, Art. 17 Abs. 3 lit. b/e). Ein getilgter Eintrag bleibt speicherbar.
- Löschfrist: Papierkorb 30 Tage (Morgenlauf); Verträge/Beschlüsse 6 bzw. 10 Jahre.
- Unterlagen (Nachtrag 04.10., Kevin): beim endgültigen Löschen einer Gesellschaft bzw. eines Vertrags **bleiben** sie in der Dateiablage
  (§ 257 HGB, § 147 AO); die Rückfrage sagt das mit Link „ansehen“ (Ablage gefiltert auf Gesellschaft/Vertrag). Das Register vermerkt
  Gelöschtes (`geloescht`: Kennung, Name/Titel, Tag, Datei-Kennungen) — Bezüge bleiben als „(gelöscht)“ lesbar; Art. 17 tilgt auch dort.
- Erinnerung vor „kündigen bis“: Glocke + Aufgabe; Telegram (wenn später an) nur „Eine Vertragsfrist naht — Details in MAKE OS“.

**Kapazität** (`kapazitaet--<haushalt>`, Planung › Kapazität) — Kategorie *Beschäftigtendaten*, Ableitung aus *Art. 9*
- Zweck: realistische Planung — verfügbare Zeit je Person gegen Aufwand von Meilensteinen/Zielen.
- Gespeichert: Grundwert, Urlaub/feste Blöcke (Titel nur für die Person selbst), Zuweisungen Person × Mandat/Kunde (Kennung),
  Zeitpunkt der Einwilligung `erholungAm`. **Kein Gesundheitswert wird gespeichert.**
- Erholung (Whoop-Recovery): zählt nur, wenn die Person **selbst eingewilligt** hat (Schalter in ihrer Personenkarte, Vorgabe
  AUS, nur sie selbst kann ihn setzen — auch der Inhaber nicht) **und** ihre Gesundheit mit allen Konten des Haushalts teilt;
  dann nur als gemeinsamer Team-Faktor auf die nächsten 14 Tage. Einzelwert sieht nur die Person. **Nie** im Business-Index
  (die Kennzahl „Kopf & Energie“ ist dort entfernt), nie an ZOE, nie in Verlauf/Protokollen.
- Rechtsgrundlage: Art. 6 Abs. 1 lit. b / § 26 BDSG, lit. f; Erholung Art. 9 Abs. 2 lit. a (Einwilligung, widerrufbar).
- Art. 15: `GET /api/kapazitaet` (eigene Werte), als Datei `GET /api/kapazitaet?auskunft=<person>` (Konto: nur die Person selbst;
  Team-Person ohne Konto: der Inhaber, auch deaktiviert) und in der Kontakt-Auskunft (`personAufzaehlen.kapazitaet`, über die E-Mail).
- Löschfrist (Nachtrag 04.10., Kevin): Team-Personen ohne Konto — **30 Tage nach dem Deaktivieren** löscht der Morgenlauf Grundwert,
  Urlaub/Blöcke, Zuweisungen und die Einwilligung (`lib/kapazitaet/aufraeumen.ts`); den Zeitpunkt (`deaktiviertAm`) setzt nur der
  Server, Reaktivieren davor erhält alles. Entferntes Konto (05.10.): Kapazitätsdaten und Plan-Zeilen beim nächsten Morgenlauf
  (`kapaEntfernteKontenAufraeumen`).
- Festgehaltener Wochenplan (05.10., `kapazitaet-plan--<haushalt>`): montags je Person verfügbare Zeit (Netto, **ohne**
  Erholungs-Faktor), geplante/gebundene Stunden je Meilenstein/Zuweisung (nur Kennungen) — für die Plan-Treue „geplant vs. Ist“.
  Löschfrist **24 Monate** je Woche (Morgenlauf), Team-Personen ohne Konto mit den übrigen Kapazitätsdaten nach 30 Tagen;
  Art. 15 in der Kapazitäts-Auskunft (`wochenplaene`).

**Papierkörbe** (CRM-Listen, Produkte, Aufgaben, Gesellschafts-Register): 30 Tage, dann endgültig (Morgenlauf; mit Verweisen
bleibt der Eintrag). Für alle Leser unsichtbar — **aber** Art. 15/17 und das Zusammenführen lesen den Bestand mit Papierkorb.

**Finanzplanung Privat/Business**: Business-Sicht serverseitig gefiltert (`lib/finanzen/plan/sicht.ts`), seit der Prüfung
auch für `?nur=kennzahlen`.

**Inbox-Status** (alt, jetzt geschlossen): `/api/state/inbox` nur im Haushalt des Inhabers; je Postfach getrennt
(eigenes Gmail; Apple/M365 nur der Inhaber).

## 2a. DSGVO-Grundlagen im Code (05.10., Branch `dsgvo-grund`)

- **Verantwortlicher** kommt aus der Einrichtung (System › Datenschutz; Rückfall Umgebung) — Auskunft, Verzeichnis, Danke-Mail und
  Selbstprüfung lesen dort; ohne Eintrag steht deutlich „Verantwortlicher fehlt — eintragen“. Kein Name mehr im Code.
- **Empfänger/AVV-Register** mit Startwerten (Hetzner, Google Workspace, Microsoft 365, Apple iCloud, Anthropic, Telegram, GitHub,
  Healthchecks, Newsletter-Werkzeug [archiviert, bis in Gebrauch], WHOOP [eigener Verantwortlicher]) — AVV-Status startet „offen“.
- **Sicherungen**: bis zu 12 Monate (14 Tages-, 8 Wochen-, 12 Monatsstände), danach überschrieben; gelöschte Daten werden bei einem
  Zurückspielen über die Grabsteine (13 Monate, länger als jede Sicherung) erneut gelöscht.
- **Verzeichnis** vollständig (u. a. Konten, Buchung, Gesundheit Art. 9, Familie, Finanzen, ZOE/KI, Brain/GitHub, Telegram, M365,
  Aufgaben/Zeit, Kampagnen/Scoring, Sicherungen/Protokolle, Bauplan), Export als Dokument (HTML/JSON).
- **Bauplan-Bildschirmfotos**: können Personendaten zeigen → verschlüsselt, Frist 90 Tage nach Abschluss der Karte, verwaist 7 Tage.
- **Pannen-Register** (Art. 33 Abs. 5) nur für den Inhaber; Löschfrist 36 Monate ab Abschluss (anwaltlich bestätigen).
- **Löschprotokoll** 36 Monate (abgeschlossene Einträge).

## 3. Offene Punkte (Entscheidung Kevin)
Siehe Bericht der Prüfung vom 04.10. — u. a. Einwilligungstext Erholung (Freiwilligkeit bei Beschäftigten; für Kunden-Instanzen mit
Angestellten gegenlesen), eigener Datenschutzhinweis der Anwendung (Abschnitt 4, erst Anwalt). **Entschieden und gebaut (04.10. spät):**
Kapazität deaktivierter Team-Personen 30 Tage nach dem Deaktivieren löschen + Art.-15-Auskunft; Unterlagen nach endgültigem Löschen
einer Gesellschaft/eines Vertrags behalten, mit Hinweis und Link.

## 4. Entwurf: Datenschutzhinweis der Anwendung (nicht veröffentlicht)

> **Datenschutz in MAKE OS.** Verantwortlich: [[aus System › Datenschutz › Verantwortlicher — dort eintragen]]. MAKE OS ist ein geschlossener Bereich
> für eingeladene Personen. Wir verarbeiten: Konto (Name, Anmelde-Adressen, Passwort-Hash, zweiter Faktor, Anmeldungen) zur
> Bereitstellung (Art. 6 Abs. 1 lit. b); Ihre eigenen Inhalte (Aufgaben, Kalender, Notizen, Planung) zur Bereitstellung der
> Funktionen; Gesundheitsdaten nur, wenn Sie sie selbst erfassen oder verbinden (Art. 9 Abs. 2 lit. a) — andere Konten sehen sie
> nur, wenn Sie „Teilen“ einschalten, in die Kapazitätsplanung gehen sie nur mit Ihrer gesonderten Einwilligung (jederzeit
> widerrufbar). Hosting in Deutschland (Hetzner, Auftragsverarbeitung); Daten verschlüsselt gespeichert. KI-Funktionen (ZOE) nutzen
> Anthropic (USA; Standardvertragsklauseln/Data Privacy Framework) — nur, wenn Sie sie aufrufen. Optional verbundene Dienste
> (Google Workspace, Apple iCloud, Microsoft 365, Whoop) nur nach Ihrer Verbindung. Speicherdauer: solange das Konto besteht;
> Gelöschtes liegt 30 Tage im Papierkorb; verschlüsselte Sicherungen bis zu 12 Monate, danach werden sie überschrieben (gelöschte Daten
> werden bei einer Wiederherstellung sofort erneut gelöscht). Ihre Rechte: Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit,
> Widerspruch, Widerruf von Einwilligungen, Beschwerde bei einer Aufsichtsbehörde. Kontakt: [[KEVIN: Adresse]].
