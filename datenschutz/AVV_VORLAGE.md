# Vertrag zur Auftragsverarbeitung (Art. 28 Abs. 3 DSGVO) — Vorlage für Kunden-Instanzen von MAKE OS

> **Entwurf — anwaltlich prüfen.** Keine Rechtsberatung, kein unterschriftsreifer Vertrag. Stand 05.10.2026.
> Platzhalter: `[[KEVIN: …]]` = Angabe/Entscheidung von MAKE, `[[ANWALT: …]]` = rechtliche Prüfung, `‹…›` = je Kunde ausfüllen.
> Die Vorlage beschreibt den **IST-Stand** der Software (siehe `TOM.md`); was noch nicht gebaut ist, steht als solches drin.

**Abgrenzung:** Dieser Vertrag betrifft nur den **Betrieb einer eigenen MAKE-OS-Instanz für den Kunden** (Hosting, Wartung, Support).
Arbeitet MAKE **zusätzlich** inhaltlich für den Kunden (z. B. als Interim Head of Sales auf Kunden-Events), ist das ein eigenes
Verhältnis (MAKE ist dort nach der eigenen Entscheidung vom 03.10. **eigener Verantwortlicher**, Übermittlung an den Kunden — siehe
`DATENSCHUTZ_NETZWERKEN.md`) und **nicht** Gegenstand dieses Vertrags. [[ANWALT: Abgrenzung im Hauptvertrag klarstellen]]

---

**zwischen**

‹Firma, Anschrift, vertreten durch›  — nachfolgend **„Verantwortlicher“** (Kunde)

**und**

[[KEVIN: MAKE Innovation GmbH bzw. die tatsächlich vertragschließende Gesellschaft — Firmierung, Anschrift, Registergericht/HRB,
vertreten durch]] — nachfolgend **„Auftragsverarbeiter“** (MAKE)

---

## § 1 Gegenstand und Dauer

(1) Gegenstand ist die Bereitstellung, der Betrieb, die Wartung und der Support einer **eigenen Instanz** der Software MAKE OS
(Edition ‹Markttraktion | MAKE OS komplett›) unter der Adresse ‹instanz-domain› gemäß dem Hauptvertrag vom ‹Datum› (Lizenz/Nutzungsvertrag).

(2) Der Vertrag gilt für die Dauer des Hauptvertrags. Er endet nicht, solange MAKE noch personenbezogene Daten des Verantwortlichen
verarbeitet (insbesondere in Sicherungen), sondern mit der Bestätigung nach § 11.

## § 2 Art und Zweck der Verarbeitung, Datenarten, Betroffene

(1) **Art der Verarbeitung:** Speichern (Hosting), Sichern und Wiederherstellen, Verschlüsseln, technische Überwachung des Betriebs,
Einspielen von Aktualisierungen, auf Weisung Einsicht zur Fehlerbehebung (Anlage 3), auf Weisung Export und Löschung; soweit
eingeschaltet: Übermittlung an KI- und Kommunikationsdienste nach Anlage 2.

(2) **Zweck:** ausschließlich die Erbringung der Leistungen aus dem Hauptvertrag. Keine Nutzung für eigene Zwecke von MAKE —
insbesondere **kein Training von KI-Modellen, keine Demo-/Beispieldaten, keine Werbung, keine Weitergabe**.

(3) **Datenarten** (je nach freigeschalteten Modulen, vom Kunden anzukreuzen):

| Modul | Datenarten | ☐ |
|---|---|---|
| Konten | Name, Anmelde-Adressen, Passwort-Hash (scrypt), zweiter Faktor, Anmelde-Protokoll (gekürzte IP) | ☐ immer |
| Markttraktion / CRM | Kontakt-, Firmen-, Vertragsdaten, Aktivitäten, Notizen, Einwilligungsnachweise, Deals, Angebote, Kampagnen, Events, Dateiablage | ☐ |
| Kalender / E-Mail (Spiegel) | Termine mit Teilnehmern, Mail-Köpfe und -Texte (Spiegel aus Google/Microsoft) | ☐ |
| Aufgaben, Ziele, Planung | Aufgaben, Kommentare, Zuständigkeiten, Meilensteine | ☐ |
| Kapazität / Zeit & Fokus | Arbeitszeit, Urlaub, Zuweisungen, gemessene Fokuszeit, Wochenpläne (**Beschäftigtendaten**) | ☐ |
| Finanzen, Gesellschafts-Register | Buchungen, Rechnungen, Gesellschafter, Organe, Verträge (**vertraulich**) | ☐ |
| Gesundheit (nur eigene Daten der Nutzer) | Vitalwerte, Logs (**Art. 9**) | ☐ — nur nach DSFA (`DSFA.md`) |
| KI (ZOE, Heads) | Inhalte der obigen Module, soweit an den KI-Dienst übermittelt | ☐ |

(4) **Betroffene:** Nutzer (Beschäftigte, Organe des Verantwortlichen), Geschäftskontakte/Interessenten/Kunden/Partner des
Verantwortlichen, Teilnehmende von Terminen und Veranstaltungen, Absender/Empfänger von E-Mails, Gesellschafter und Vertragspartner.

(5) Ort der Verarbeitung: Rechenzentrum in Deutschland (Anlage 2). Übermittlungen in Drittländer nur nach § 7.

## § 3 Weisungen

(1) MAKE verarbeitet die Daten nur auf **dokumentierte Weisung** des Verantwortlichen (Art. 28 Abs. 3 lit. a, Art. 29) — auch bei
Drittlandübermittlungen —, es sei denn, eine gesetzliche Pflicht verlangt etwas anderes; dann teilt MAKE dies vorher mit, sofern zulässig.

(2) Die Weisungen sind in diesem Vertrag und dem Hauptvertrag festgelegt. Weitere Weisungen erteilt der Verantwortliche in Textform an
[[KEVIN: Support-Adresse]]. Weisungsberechtigt: ‹Namen/Funktionen›. Weisungsempfänger bei MAKE: [[KEVIN: Namen/Funktionen]].

(3) Die **Einstellungen der Instanz** (Modul- und KI-Schalter, Löschfristen, Rollen, verbundene Dienste), die der Verantwortliche
selbst in der Software oder bei der Einrichtung (Onboarding-Protokoll) wählt, gelten als Weisung.

(4) Hält MAKE eine Weisung für rechtswidrig, weist MAKE unverzüglich darauf hin und darf die Ausführung bis zur Bestätigung aussetzen
(Art. 28 Abs. 3 Satz 3).

## § 4 Vertraulichkeit

MAKE setzt nur Personen ein, die auf Vertraulichkeit verpflichtet sind oder einer gesetzlichen Verschwiegenheitspflicht unterliegen
(Art. 28 Abs. 3 lit. b), und die mit den Datenschutzbestimmungen vertraut sind. Die Verpflichtung gilt über das Ende der Tätigkeit hinaus.
[[KEVIN: Verpflichtungserklärungen vorhanden? — `TOM.md` Abschnitt 3]]

## § 5 Technische und organisatorische Maßnahmen

(1) MAKE trifft die Maßnahmen nach Art. 32, beschrieben in **Anlage 1** (`TOM.md`, Fassung vom ‹Datum›). Für die Kunden-Instanz gilt
zusätzlich: eigener Container, eigener Datenordner, **eigener Datenschlüssel, eigener Pepper, eigener Sicherungsschlüssel (age)**,
eigene Domain, eigene Sicherungen.

(2) Die Maßnahmen dürfen weiterentwickelt werden, solange das Schutzniveau nicht sinkt. Wesentliche Änderungen werden dokumentiert
und dem Verantwortlichen mitgeteilt.

## § 6 Unterauftragsverarbeiter

(1) Der Verantwortliche genehmigt die in **Anlage 2** genannten Unterauftragsverarbeiter (allgemeine schriftliche Genehmigung,
Art. 28 Abs. 2). **Optionale** Dienste werden nur eingesetzt, wenn der Verantwortliche sie in seiner Instanz einschaltet bzw. verbindet.

(2) **Änderungsverfahren:** MAKE informiert mindestens [[KEVIN: z. B. 4 Wochen]] vor Hinzuziehung oder Ersetzung eines
Unterauftragsverarbeiters in Textform. Der Verantwortliche kann binnen [[KEVIN: 2 Wochen]] aus wichtigem datenschutzrechtlichem
Grund widersprechen. Kommt keine Einigung zustande, kann der Verantwortliche den betroffenen Dienst abschalten oder den Hauptvertrag
außerordentlich kündigen. [[ANWALT: Fristen und Folgen]]

(3) MAKE verpflichtet jeden Unterauftragsverarbeiter vertraglich auf dieselben Datenschutzpflichten (Art. 28 Abs. 4) und haftet für ihn.

## § 7 Drittländer

Übermittlungen außerhalb des EWR erfolgen nur bei Vorliegen der Voraussetzungen der Art. 44 ff. (Angemessenheitsbeschluss, z. B.
EU-US Data Privacy Framework für zertifizierte Empfänger, oder Standardvertragsklauseln mit Transfer-Folgenabschätzung). Die jeweilige
Garantie ist in Anlage 2 genannt. KI-Dienste sind in der Instanz **abschaltbar** (§ 3 Abs. 3).

## § 8 Unterstützung bei Betroffenenrechten (Art. 15–22)

MAKE unterstützt mit geeigneten technischen Mitteln (Art. 28 Abs. 3 lit. e). Die Software stellt bereit:

| Recht | Werkzeug in MAKE OS (IST) |
|---|---|
| Auskunft (Art. 15) | Kontakt › Datenschutz: Auskunft über alle Bestände inkl. Papierkorb, Buchungen, Termin-Bezüge, Gesellschafts-Register, Kapazität (`personAufzaehlen`); Kapazitäts-Auskunft je Person; Nutzer sehen/exportieren eigene Daten |
| Berichtigung (Art. 16) | Bearbeiten in der Akte (Änderungsprotokoll) |
| Löschung (Art. 17) | „Person löschen“ über alle Speicher laut Speicher-Register, Grabstein + Sperrliste, Löschprotokoll mit Status; Bericht nennt Stellen „dort löschen“ (Google/Apple) und Empfänger (Art. 19) |
| Einschränkung (Art. 18) | Sperre je Kontakt, wirkt in allen Lesern und KI-Paketen |
| Datenübertragbarkeit (Art. 20) | CSV-Export Kontakte/Aufgaben; Auskunft als Datei |
| Widerspruch (Art. 21) | Werbesperre in einem Klick, überall wirksam |
| Art. 22 | keine automatisierten Entscheidungen |

Erreicht ein Antrag MAKE direkt, leitet MAKE ihn unverzüglich an den Verantwortlichen weiter und beantwortet ihn nicht selbst.

## § 9 Unterstützung bei Art. 32–36 und Meldung von Verletzungen

(1) MAKE unterstützt bei Sicherheit der Verarbeitung, Meldungen, Benachrichtigungen, DSFA und vorheriger Konsultation unter
Berücksichtigung der verfügbaren Informationen (Art. 28 Abs. 3 lit. f). Entwürfe der DSFA zu Gesundheit/KI, Beschäftigten-Planung und
KI-Hintergrundläufen stellt MAKE bereit (`DSFA.md`).

(2) **Verletzungen** meldet MAKE dem Verantwortlichen **unverzüglich, ohne schuldhaftes Zögern**, möglichst innerhalb von
[[KEVIN: 24 Stunden]] nach Kenntnis, mit den Angaben nach Art. 33 Abs. 3, soweit bekannt; Teilinformationen werden nachgereicht.
Ablauf und Vorlage: `DATENPANNEN.md` › 6. Meldung an die Behörde und Benachrichtigung der Betroffenen obliegen dem Verantwortlichen.

## § 10 Zugriff durch MAKE (Support)

Einsicht in Inhalte der Instanz nimmt MAKE nur nach **Anlage 3** vor (auf Weisung, protokolliert, zeitlich begrenzt).

## § 11 Löschung und Rückgabe bei Vertragsende

(1) Nach Ende der Leistungen **gibt MAKE die Daten nach Wahl des Verantwortlichen zurück** (Export) **und löscht** sie danach, sofern
keine gesetzliche Pflicht zur Speicherung besteht (Art. 28 Abs. 3 lit. g). Der Verantwortliche trifft seine Wahl binnen
[[KEVIN: 30 Tagen]] nach Vertragsende; danach wird gelöscht.

(2) **Export (IST):** CSV-Exporte aus der Oberfläche sowie auf Wunsch ein entschlüsseltes Gesamtarchiv der Bestände (JSON-Dateien
und Dateiablage), übergeben verschlüsselt (age-Empfänger des Verantwortlichen oder passwortgeschütztes Archiv, Passwort getrennt).
[[KEVIN: Format und Werkzeug festlegen — eine Ein-Klick-Gesamtausgabe gibt es noch nicht]]

(3) **Löschung umfasst:** Datenordner und Grabsteine der Instanz, Container und Volumes, Schlüssel (Datenschlüssel, Pepper,
age-Identität) — dadurch werden verbleibende verschlüsselte Kopien unlesbar —, Nachtarchive am Server und am Sicherungsort von MAKE
(alle Generationen), Support-Notizen. Hoster-Abbilder laufen nach höchstens 7 Tagen ab bzw. werden gelöscht.

(4) MAKE **bestätigt die Löschung in Textform** mit Datum, Umfang und etwaigen Ausnahmen (mit Grund):

```
Löschbestätigung — MAKE-OS-Instanz ‹instanz›
Verantwortlicher: ‹Firma›     Vertragsende: ‹Datum›     Export übergeben am: ‹Datum› (Format: ‹…›)
Gelöscht am ‹Datum›: [ ] Datenordner  [ ] Grabsteine  [ ] Container/Volumes  [ ] Nachtarchive Server (n = …)
[ ] Sicherungsort MAKE (n = …)  [ ] Schlüssel (Daten, Pepper, age)  [ ] DNS  [ ] Support-Notizen
Hoster-Abbilder: [ ] gelöscht  [ ] laufen ab am ‹Datum›
Ausnahmen (Grund): ‹z. B. Rechnungen an den Kunden, § 147 AO›
Ort, Datum, Unterschrift MAKE
```

## § 12 Nachweise und Kontrollen

(1) MAKE stellt alle erforderlichen Informationen zum Nachweis der Pflichten bereit (Art. 28 Abs. 3 lit. h): aktuelle `TOM.md`,
Liste der Unterauftragsverarbeiter, Zusammenfassung der Selbstprüfung (Stammdaten › Datenschutz), Head-of-IT-Status (Sicherung,
Verschlüsselung), Protokolle nach Anlage 3. [[KEVIN: Zertifizierungen? — derzeit keine]]

(2) Der Verantwortliche darf Kontrollen (auch durch beauftragte, zur Verschwiegenheit verpflichtete Prüfer) nach Anmeldung mit
angemessener Frist [[KEVIN: z. B. 14 Tage]] während der Geschäftszeiten durchführen, ohne den Betrieb zu stören. Kosten:
[[ANWALT: Regelung]]. Der Zugang zum Rechenzentrum richtet sich nach den Regeln des Hosters (Nachweis über dessen Zertifikate).

## § 13 Haftung

[[ANWALT: Haftung nach Art. 82 DSGVO, Freistellung, Haftungsbegrenzung im Verhältnis zum Hauptvertrag, Versicherung]]

## § 14 Schlussbestimmungen

Bei Widersprüchen geht dieser Vertrag dem Hauptvertrag in Datenschutzfragen vor. Änderungen in Textform. Salvatorische Klausel,
Gerichtsstand, anwendbares Recht: [[ANWALT]].

‹Ort, Datum› — Verantwortlicher ‹Unterschrift›  ·  ‹Ort, Datum› — MAKE ‹Unterschrift›

---

## Anlage 1 — Technische und organisatorische Maßnahmen

Es gilt `datenschutz/TOM.md` in der Fassung vom ‹Datum› (als PDF beigefügt), einschließlich der dort genannten **offenen Punkte**.
Vor Unterzeichnung mit einem Kunden müssen mindestens erledigt sein: L1 (age), L2 (Probe-Restore), L3 (2FA-Pflicht), L4 (AVVs der
Unterauftragsverarbeiter), L15 (Neutralisierung) — siehe `KUNDEN_ONBOARDING_DATENSCHUTZ.md` › A.

---

## Anlage 2 — Unterauftragsverarbeiter (je Instanz konfigurierbar)

Stand IST: Verträge mit den Anbietern sind **noch nicht nachgewiesen** (`TOM.md` L4). Angaben zu Sitz/Garantie vor Verwendung
beim Anbieter prüfen. [[KEVIN: je Zeile Vertragsstand + Ablageort]]

| Anbieter | Leistung | Daten | Ort | Drittland-Garantie | Einsatz |
|---|---|---|---|---|---|
| Hetzner Online GmbH, Gunzenhausen (DE) | Server, Speicher, Abbilder (7 Tage) | alle Daten der Instanz (verschlüsselt im Ruhezustand) | Deutschland | — (EU) | **immer** |
| Anthropic, PBC (USA); ggf. EU-Vertragspartner laut Anbieter-Bedingungen | KI-Modelle (ZOE, Heads, Entwürfe, Websuche des Research-Agenten) | Inhalte, die ein KI-Aufruf enthält (gekapselt, ohne Privatnotizen/gesperrte Personen) | USA | Standardvertragsklauseln im DPA des Anbieters; DPF-Zertifizierung prüfen [[KEVIN]]; **Zero-Data-Retention anfragen** [[KEVIN]] | **optional** (Schalter; ohne Schlüssel aus) |
| Google Ireland Ltd. / Google LLC | Google Workspace: Kalender, Gmail (Spiegel in der Instanz) | Termine, Teilnehmer, Mails | EU/USA | Cloud Data Processing Addendum, SCC/DPF | **optional** (Kunde verbindet sein eigenes Workspace — dann ist Google in der Regel **sein** Auftragsverarbeiter, nicht MAKEs Unterauftragnehmer) [[ANWALT: Einordnung]] |
| Microsoft Ireland Operations Ltd. | Microsoft 365: Postfach, Kalender | Mails, Termine | EU (Data Boundary)/USA | DPA, SCC/DPF | **optional** (wie Google) |
| Telegram (Anbieter laut Bedingungen) | Benachrichtigungen (Anmelde-Alarm, Head of IT) | neutrale Texte ohne Namen Dritter; Anmelde-Alarm mit gekürzter IP | außerhalb EU | **ungeklärt** | **für Kunden-Instanzen nicht vorgesehen**, bis geklärt [[KEVIN]] |
| Newsletter-/Versanddienst | Massenversand | Empfängeradressen, Inhalte | — | — | **noch nicht gewählt** [[KEVIN]] |
| *keine Unterauftragsverarbeiter* (keine Kundendaten) | Let's Encrypt/ZeroSSL (Zertifikate: nur Domain), Healthchecks.io (nur Ping), GitHub (nur Code — **solange kein Kunden-Vault auf GitHub liegt**) | — | — | — | — |

Vom **Nutzer selbst** verbundene Dienste (z. B. Whoop, Apple iCloud) sind keine Unterauftragsverarbeiter von MAKE; Apple iCloud
(Verbraucherkonto) ist für geschäftliche Daten nicht geeignet (kein AVV).

---

## Anlage 3 — Support-Zugriffsprozess

**Grundsatz:** MAKE schaut **nicht** in Inhalte einer Kunden-Instanz. Betrieb und Überwachung laufen über Zahlen ohne Inhalte
(Head of IT, `sicherung.json`, Healthcheck). Inhalte sieht MAKE nur in diesen Fällen:

| Fall | Voraussetzung |
|---|---|
| A — Fehlerbehebung auf Anfrage | **dokumentierte Weisung** des Verantwortlichen (Ticket/E-Mail einer weisungsberechtigten Person) mit Anlass und Umfang |
| B — Notfall (Sicherheitsvorfall, Datenverlust droht) | ohne vorherige Weisung **nur zum Eindämmen**; Information des Verantwortlichen **unverzüglich** danach, spätestens [[KEVIN: 24 h]] |
| C — Wiederherstellung auf Wunsch | Weisung; Einzel-Wiederherstellung zeigt nur Kennungen/Feldnamen |

**Ablauf**
1. Weisung prüfen und im **Support-Protokoll** erfassen (wer, wann, warum, Umfang, Zeitfenster).
2. **Datenarmer Weg zuerst:** Logs ohne Inhalte, HOI-Befunde, Vorschau-Werkzeuge (nur Kennungen); Inhalte nur, wenn nötig.
3. Zugriff per SSH mit **eigenem Schlüssel je Instanz** (kein Sammelschlüssel), nur Personen nach § 4. Kein Kopieren von Daten auf
   Rechner von MAKE — außer verschlüsselten Archiven für eine Wiederherstellung, danach löschen.
4. **Vier-Augen (optional, auf Wunsch des Verantwortlichen):** Freigabe des Zugriffs durch eine zweite Person bei MAKE bzw. gemeinsame
   Sitzung mit dem Verantwortlichen (Bildschirmfreigabe statt Server-Zugriff).
5. Nach Abschluss: Zugriff beenden, Protokoll an den Verantwortlichen (auf Wunsch je Zugriff, sonst monatlich).

**Schlüssel-Verwahrung je Instanz**

| Schlüssel | Verwahrung | Wer hat Zugriff |
|---|---|---|
| Datenschlüssel, Pepper | Server der Instanz (Datei 0400) + Passwort-Manager MAKE (Tresor **je Kunde**) + Papier im Tresor | [[KEVIN: Personen]]; auf Wunsch zusätzlich der Verantwortliche |
| age-Identität (Sicherungen) | **nie auf dem Server**; Passwort-Manager MAKE je Kunde + Papier; Option: Verantwortlicher hält eine eigene age-Identität als zweiten Empfänger | wie oben |
| SSH-Support-Schlüssel | je Instanz und Person, mit Hardware-Schlüssel oder Passphrase; Entzug bei Ausscheiden | Support-Personen |

**Support-Protokoll (Vorlage)**

| Datum/Zeit von–bis | Instanz | Person MAKE | Fall (A/B/C) | Weisung von / Ticket | Zweck | Was eingesehen/verändert | Vier-Augen | Mitteilung an Kunden am |
|---|---|---|---|---|---|---|---|---|

**IST-Stand (ehrlich):** Es gibt noch **kein** technisches Zugriffsprotokoll und keine zeitlich begrenzten Schlüssel; nachvollziehbar
ist ein SSH-Zugriff nur über das Systemprotokoll des Servers. Das Support-Protokoll wird bis dahin **von Hand** geführt
(Ablage: [[KEVIN: Ort]]). Kunden-Instanzen gibt es noch nicht; die Einrichtung je Instanz ist Handarbeit (`KUNDEN_ONBOARDING_DATENSCHUTZ.md`).
