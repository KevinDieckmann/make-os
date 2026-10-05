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
| KI-Tor (Schalter, Art.-9-Einwilligung, Pseudonymisierung, Protokoll) | `lib/datenschutz/ki-tor.ts` über `askText` (lib/anthropic.ts), Werkzeuge `fuehreAus` | `tests/ki-datenschutz.test.ts` |
| Gesundheits-Einwilligung (a/b/c) | `lib/datenschutz/gesundheit-einwilligung.ts`, Route `/api/datenschutz/gesundheit` | dieselben |
| Telegram-Texte | `lib/datenschutz/telegram-text.ts`, `telegramSicher` in `lib/telegram.ts` | dieselben |

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
  Server, Reaktivieren davor erhält alles. Offen: Einträge eines entfernten Kontos (Konten werden nicht deaktiviert).
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

**KI, Gesundheit (Art. 9) und Telegram** (05.10., Branch `dsgvo-ki`) — die EINE Stelle: `askText` → `lib/datenschutz/ki-tor.ts`
- **Gesundheits-Einwilligung** (`lib/datenschutz/gesundheit-einwilligung.ts`, Bestand `gesundheit-einwilligungen`, Oberfläche System ›
  Datenschutz): drei getrennte, ausdrückliche Einwilligungen je Person — (a) in MAKE OS verarbeiten, (b) an die KI geben (Anthropic, USA),
  (c) mit dem Partner teilen inkl. Weitergabe an dessen ZOE. Wortlaut + Fassung + Zeitpunkt + Widerruf; Nachweis nur anhängend (Art. 7
  Abs. 1). Vorgabe (b)/(c) aus. Bestands-Konten (vor der Einführung, kompatible Instanz): Hinweis „bitte bestätigen“, Verarbeitung wie
  bisher, aber nichts an KI/Partner. Neue Konten ohne (a): die Schreibwege (Vitalwerte, Haut, Journal, Streak, Routinen-Log, Sport, Whoop)
  antworten 403. Nur die Person selbst erklärt (Dienstweg, fremde Person, auch der Inhaber → 403).
- **Ohne (b) kein Gesundheitswert an ein Modell:** `gatherBrain` liest Vitalwerte gar nicht erst (Index ohne Gesundheits-Säule und
  Gesamtzahl), `eigenerGesundheitsKontext` leer, Ernährungs-Profile nur als neutrale Küchenregel („nie“), Fokus/Loop/Tageslauf/Planung/
  Performance ohne Werte, ZOE-Gesundheitswerkzeuge gesperrt; das Tor sperrt jeden Aufruf mit Kategorie „gesundheit“ ohne (b). Die ZOE
  des Partners liest nur mit (b)+(c) des Eigentümers UND „Teilen“ (`gesundheitFuerZoe`). Der globale Kompass-Regler „Körperdaten an
  Agenten“ (Vorgabe an) ist entfernt.
- **KI-Schalter** (`lib/datenschutz/ki-einstellungen.ts`, Bestand `ki-einstellungen`): je Instanz (Inhaber) und je Person (schränkt nur
  ein): Hintergrund-KI (automatische Läufe), Web-Suche, Bereiche CRM/Kalender/Aufgaben/Finanzen/Brain für ZOE. Erzwungen im KI-Tor und in
  `fuehreAus`; Prompt-Bauer lassen gesperrte Bereiche weg. **Vorgaben:** neue Instanz „sparsam“ (Hintergrund-KI und Web-Suche AUS,
  Bereiche an); eine Instanz mit Altbestand (Kevin) „kompatibel“ (alles an wie bisher) — beim ersten Lesen festgeschrieben.
- **KI-Protokoll** (`lib/datenschutz/ki-protokoll.ts`, `ki-protokoll--JJJJ-MM`): je Modellaufruf nur Metadaten (Zeit, Zweck, Lauf, Person,
  Kategorien, Anzahl, pseudonymisiert, gesperrt + Grund) — nie Inhalte, nie Kennungen Dritter; 12 Monate. Einsehbar unter System ›
  Datenschutz; Art. 15: `GET /api/datenschutz/ki-protokoll?auskunft=1` (Konto-Person), Kontakt-Auskunft `personAufzaehlen.kiEmpfaenger`
  (Empfänger + Aufrufe der Kategorie „crm“ mit Zeitraum). Verzeichnis: eigener Eintrag `vv-ki` (`lib/datenschutz/vvt-ki.ts`).
- **Pseudonymisierung** (`lib/datenschutz/pseudonym.ts`): in Hintergrund-Läufen Vor-+Nachname / „Nachname, Vorname“ / Adresse der
  Kontakte → `[K17]`/`[K17-mail]`, Antwort lokal zurück. Grenzen: nur Kontakte der Kartei, nur vollständige Namen. **Offen:** Research
  (Suchauftrag ist das Thema), Freitext-Namen ohne Kontakt, Gespräche mit ZOE (vom Nutzer ausgelöst, nicht pseudonymisiert).
- **Telegram** (`lib/datenschutz/telegram-text.ts`): nur neutrale Hinweise mit Link; ZOE-Antworten im ZOE-Verlauf; Ausnahme je Person
  „ZOE-Antworten vollständig über Telegram (unverschlüsselt, Drittland)“ mit Hinweistext, Vorgabe aus; Sicherheitsnetz in `sendeAnPerson`.
- **KI-VO Art. 50:** Kennzeichen `ki` in Antworten mit KI-Text, Marke „KI-Entwurf“ (`components/os/KiMarke.tsx`), „· KI“ an ZOE.

## 3. Offene Punkte (Entscheidung Kevin)
**Aus dem Paket 05.10. (KI/Gesundheit/Telegram):** Einwilligungstexte (a)/(b)/(c) und der Telegram-Hinweis anwaltlich gegenlesen;
Aufbewahrung der API-Daten bei Anthropic im AVV prüfen; Löschung des Einwilligungs-Nachweises nach Kontoende (3 Jahre) noch nicht
automatisch; Löschregel „KI-Protokoll 12 Monate“ und die Selbstprüfung „KI“ in `lib/crm/datenschutz.ts` nachziehen (paralleles Paket);
Research ohne Pseudonymisierung.
Siehe Bericht der Prüfung vom 04.10. — u. a. Einwilligungstext Erholung (Freiwilligkeit bei Beschäftigten; für Kunden-Instanzen mit
Angestellten gegenlesen), eigener Datenschutzhinweis der Anwendung (Abschnitt 4, erst Anwalt). **Entschieden und gebaut (04.10. spät):**
Kapazität deaktivierter Team-Personen 30 Tage nach dem Deaktivieren löschen + Art.-15-Auskunft; Unterlagen nach endgültigem Löschen
einer Gesellschaft/eines Vertrags behalten, mit Hinweis und Link.

## 4. Entwurf: Datenschutzhinweis der Anwendung (nicht veröffentlicht)

> **Datenschutz in MAKE OS.** Verantwortlich: [[KEVIN: Gesellschaft, Anschrift, Kontakt]]. MAKE OS ist ein geschlossener Bereich
> für eingeladene Personen. Wir verarbeiten: Konto (Name, Anmelde-Adressen, Passwort-Hash, zweiter Faktor, Anmeldungen) zur
> Bereitstellung (Art. 6 Abs. 1 lit. b); Ihre eigenen Inhalte (Aufgaben, Kalender, Notizen, Planung) zur Bereitstellung der
> Funktionen; Gesundheitsdaten nur, wenn Sie sie selbst erfassen oder verbinden (Art. 9 Abs. 2 lit. a) — andere Konten sehen sie
> nur, wenn Sie „Teilen“ einschalten, in die Kapazitätsplanung gehen sie nur mit Ihrer gesonderten Einwilligung (jederzeit
> widerrufbar); an die KI und an die ZOE Ihres Partners nur mit je eigener Einwilligung. Hosting in Deutschland (Hetzner,
> Auftragsverarbeitung); Daten verschlüsselt gespeichert. KI-Funktionen (ZOE) nutzen Anthropic (USA; Standardvertragsklauseln/Data
> Privacy Framework) — wenn Sie ZOE fragen oder einen Entwurf anfordern UND, soweit eingeschaltet, in automatischen Läufen der Software
> (z. B. Morgenlauf, Lagebilder); dabei werden Namen von Kontakten durch Platzhalter ersetzt. Was an die KI geht, stellen Sie unter
> System › Datenschutz ein (Hintergrund-KI, Web-Suche, Bereiche); jeder Aufruf wird ohne Inhalte protokolliert (12 Monate). Telegram
> erhält nur Hinweise ohne Inhalte, außer Sie schalten die Ausnahme selbst ein. Optional verbundene Dienste
> (Google Workspace, Apple iCloud, Microsoft 365, Whoop) nur nach Ihrer Verbindung. Speicherdauer: solange das Konto besteht;
> Gelöschtes liegt 30 Tage im Papierkorb. Ihre Rechte: Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit,
> Widerspruch, Widerruf von Einwilligungen, Beschwerde bei einer Aufsichtsbehörde. Kontakt: [[KEVIN: Adresse]].
