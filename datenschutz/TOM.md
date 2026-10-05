# Technische und organisatorische Maßnahmen (Art. 32 DSGVO) — MAKE OS

> **Entwurf — anwaltlich prüfen.** Keine Rechtsberatung. Beschreibt den **IST-Stand** von Code und Server (Branch
> `entwicklung`, Stand e15a9a8, 05.10.2026) — nicht den Wunschstand. Was fehlt, steht offen in Abschnitt 4 (Lücken).
> Dient zugleich als **Anlage 1 zum AVV** (`AVV_VORLAGE.md`) für Kunden-Instanzen.

Verantwortlich für dieses Dokument: [[KEVIN: Gesellschaft (Firmierung, Anschrift) und zuständige Person eintragen]].
Geltungsbereich: jede MAKE-OS-Instanz (eigene Instanz des Inhaber-Haushalts, Demo-Instanz, künftige Kunden-Instanzen),
der Server beim Hoster, die Sicherungen (Server, Mac des Inhabers, Hoster-Abbilder) und das Code-Repository.

Legende Status: **umgesetzt** · **teilweise** (gebaut, aber nicht überall aktiv bzw. nicht nachgewiesen) · **offen**.

---

## 1 · Grundsätze der Architektur

| Grundsatz | IST | Nachweis im Repo | Status |
|---|---|---|---|
| Eigene Instanz je Kunde (kein gemeinsames SaaS) | Geplant und für Testkunden festgelegt (eigener Container, eigener Datenordner, eigene Schlüssel, eigene Adresse); heute läuft genau **eine** produktive Instanz (Inhaber-Haushalt) und lokal eine Demo-Instanz. Die „Instanz-Fabrik“ (Paket 4) ist nicht gebaut. | `PLATTFORM_PLAN.md`, `DEMO.md`, `lib/demo/schutz.ts` | teilweise |
| Daten liegen nur auf dem Server (nicht auf Entwickler-Rechnern) | Lokal nur Wegwerfdaten (`start.sh --entwicklung`); Rohbau-Regel: an Dritte geht nur Code, nie Daten | `CLAUDE.md` › Eiserne Regeln 1/2, `tests/repo-sauber.test.ts` | umgesetzt |
| Human-in-the-Loop | Nichts verlässt das System Richtung Dritter ohne Klick (Mails nur als Entwurf/Klick, Einladungen nach Rückfrage, KI-Vorschläge nur über den Stapel) | `CLAUDE.md` › Eiserne Regel 3, `lib/kalender/icloud.ts` (Einladungen nur mit `einladungBestaetigt`) | umgesetzt |
| Trennung serverseitig, nie nur ausgeblendet | Sichten (Privat/Business), Rollen, Haushalte, Gesellschaften werden auf dem Server gefiltert; Wächtertests „Sicht X bekommt nichts aus Y“ | `CLAUDE.md` › Plattform-Regel, z. B. `lib/finanzen/plan/sicht.ts`, `lib/inbox/status-sicht.ts` | umgesetzt (neue Features: Pflicht) |
| Register aller Speicher | Jeder Bestandsname steht mit Personenbezug, Art.-17-Behandlung, Rechtsgrundlage, Löschfrist im Register; ein Test wird rot bei unbekannten Namen | `lib/crm/speicher-register.ts`, `tests/datenschutz-register.test.ts` | umgesetzt (Altbestand ohne Pflichtangaben wird abgebaut) |

---

## 2 · Maßnahmen nach Kontrollzielen

### 2.1 Zutrittskontrolle (physisch)

| Maßnahme | IST | Status |
|---|---|---|
| Rechenzentrum | Hetzner Online GmbH, Cloud-Server in Deutschland (Einrichtungsplan: Falkenstein). Physische Sicherung, Zutritt und Zertifizierung liegen beim Hoster. [[KEVIN: Standort im Hetzner-Menü bestätigen; ISO-27001-Zertifikat des Hosters als PDF in die Ablage]] | umgesetzt beim Hoster, Nachweis offen |
| Arbeitsplätze / Mac des Inhabers | Der Mac hält **Sicherungsarchive** (`~/MAKE-OS-Sicherungen`, täglich abgeholt) und die Schlüssel im Passwort-Manager. Physische Sicherung, Festplattenverschlüsselung (FileVault) und Bildschirmsperre sind nicht dokumentiert. [[KEVIN: FileVault an? Bildschirmsperre? Aufbewahrungsort Papier-Schlüssel (Tresor)]] | offen (Nachweis) |
| Mobile Geräte | Geräteregel für Handys (Sperre, kein geteiltes Konto, Abmelden) ist als To-do benannt, nicht festgeschrieben (`DATENSCHUTZ_NETZWERKEN.md` › 5). | offen |

### 2.2 Zugangskontrolle (Systeme)

**Server**
- SSH nur mit Schlüssel (`PasswordAuthentication no`), Root-Login aus (`PermitRootLogin no`, seit 26.09.), Admin nur als Nutzer
  `make` mit `sudo`; `AllowTcpForwarding no` — `deploy/server-haerten.sh`.
- `fail2ban` für SSH (4 Versuche / 10 min, Sperre 1 h, steigend), `ufw limit OpenSSH`, Kernel-Netzwerk-Härtung (`sysctl`).
- Automatische Sicherheitsupdates, Neustart bei Bedarf 04:30 (`unattended-upgrades`).
- **Ausroll-Schlüssel** mit Forced Command (`authorized_keys` `command="…/deploy/ausrollen.sh",restrict` — darf nur
  `git merge --ff-only` + `docker compose up -d --build`); **Abhol-Schlüssel** des Mac ebenso eingeschränkt
  (`deploy/sicherung-ausgeben.sh`: nur `liste`, `holen`, `bestaetigen`).
- Schwäche: `make` hat `sudo` **ohne Passwort** (`/etc/sudoers.d/make`, DEPLOY.md › Härtung) — wer den SSH-Schlüssel hat, ist root.

**Anwendung**
- Konten mit Passwort, gespeichert als **scrypt**-Hash (Node-Standardparameter, 64-Byte-Schlüssel, zufälliges Salz je Konto,
  Vergleich in konstanter Zeit) — `lib/zugang/konten.ts`.
- **Zweiter Faktor (TOTP, RFC 6238)** mit Wiederherstellungscodes (nur Hashes gespeichert) — `lib/zugang/totp.ts`,
  `/api/konto/zwei-faktor`. **Je Konto freiwillig, nicht erzwungen.** [[KEVIN: 2FA-Pflicht für alle Konten einführen?]]
- Sitzung: signiertes Cookie `__Host-make-os-sitzung` (Produktion), 14 Tage, an den Passwort-Stand gebunden (Passwortwechsel
  meldet andere Geräte ab), „Alle anderen Geräte abmelden“, Abmelden widerruft — `lib/zugang/sitzung.ts`, `stand-pruefung.ts`.
- Drosseln: Anmeldung je IP und je Konto, 2FA-Codes, Passwortprüfungen — `lib/zugang/drossel.ts`.
- **Anmelde-Alarm**: neue Netze und ≥ 5 Fehlversuche in 10 Minuten werden der Person gemeldet — **nur, wenn Telegram
  konfiguriert ist** (`TELEGRAM_BOT_TOKEN`); sonst nur im Anmelde-Protokoll und im Head of IT sichtbar — `lib/zugang/anmelde-alarm.ts`.
- Öffentlich ohne Sitzung sind nur `/anmelden`, wenige Konto-Wege, der CSP-Empfänger und die eng gefassten Buchungsseiten
  (Regex + eigener Test) — `middleware.ts`, `tests/buchung-middleware.test.ts`.
- Konten anlegen nur per Einladung des Inhabers (zeitlich begrenzter Code).

**Externe Konten** (Hoster, GitHub, Google, Microsoft, Anthropic): 2FA laut DEPLOY.md gefordert.
[[KEVIN: 2FA bei Hetzner, GitHub (beide Konten), Google Workspace, Microsoft, Anthropic-Konsole bestätigen]]

### 2.3 Zugriffskontrolle (Berechtigungen in der Anwendung)

- Rollen: `inhaber` (erstes Konto, lädt ein, Inhaber-Funktionen über `nurInhaber`) und `mitglied`; zusätzlich Finanzrecht
  `business` (nur Business-Sicht der Finanzplanung, Privates serverseitig herausgefiltert) — `lib/zugang/konten.ts`.
- **Haushalts-Tor**: Kartei, CRM, Kalender, Gesellschafts-Register, ZOE-Stapel nur im Haushalt des Inhabers
  (`imHaushaltDesInhabers`, `karteiZugang`) — fremde Konten bekommen 403.
- **Jede Route liest die Person aus der Sitzung**, nie Rückfall auf eine feste Person (Eiserne Regel 5; Restfälle in
  Lese-Routen sind dokumentiert, CLAUDE.md › Prüfung S1).
- Dienstweg (Takt, Skripte) nur mit Dienstschlüssel, Vergleich in konstanter Zeit (`lib/zugang/dienst.ts`); der Arbeiter-Container
  bekommt **nur** diesen Schlüssel, nicht die übrigen Geheimnisse; Head of IT hat einen eigenen, auf `/api/hoi/*` beschränkten Schlüssel.
- Privates je Person: Gesundheit nur bei „Teilen“, private Termine/Notizen anderer als „Belegt“, private Notizen je Person.
- **Art. 18 (Einschränkung)** wirkt als Sperre in allen Lesern, Listen, KI-Paketen (`ausgenommen(k)`).
- KI (ZOE, Heads): bekommt Arbeitsfelder, nie Privatnotizen, nie eingeschränkte Personen; fremder Text wird gekapselt
  (`fremd()`), danach sind schreibende Werkzeuge nur Vorschläge — `lib/anthropic.ts`, `lib/zoe/fremd.ts`.

### 2.4 Weitergabekontrolle (Transport, Übermittlung)

- **TLS** über Caddy (Let's Encrypt, Rückfall ZeroSSL), **HSTS** 1 Jahr mit `includeSubDomains` für die App-Domain —
  `deploy/caddy/Caddyfile`.
- **Content-Security-Policy** aus der App (Produktion: `default-src 'self'` …), Verstöße gehen an `/api/hoi/csp` (Head of IT);
  X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, COOP; Buchungsseiten mit strengeren Köpfen
  (`no-referrer`, kein Rahmen) — `next.config.mjs`. Server-Kennung (`Server`, `X-Powered-By`) entfernt. Schriften selbst ausgeliefert
  (keine Abrufe bei Font-Diensten).
- Ausnahme: der Altbestand `/finanz-dashboard.html` hat **keine CSP** (lädt Firebase von außen). [[KEVIN: Altbestand abschalten?]]
- Kein Versand ohne Klick; Exporte (CSV, Kunden-Übergabe) nur mit Sitzung, nie über den Dienstweg; Übergaben an Kunden werden
  protokolliert (`uebergabe-journal--*`).
- Telegram-Texte ohne Namen Dritter (`telegramText`, „Details in MAKE OS“).
- Sicherungs-Abholung: Pull vom Mac über eingeschränkten Schlüssel, Prüfung Größe + SHA-256 — der Server kann den Mac nicht erreichen.
- Zugangsdaten zu iCloud/Google nur in der Server-`.env` bzw. verschlüsselt im Bestand; OAuth mit PKCE + `state`; Tokens nie im Browser.

### 2.5 Eingabekontrolle (Nachvollziehbarkeit)

| Protokoll | Inhalt | Aufbewahrung |
|---|---|---|
| Änderungsprotokoll (`aenderungsprotokoll--*`) | wer, wann, Bestand, Feldnamen, Kontakt nur als HMAC-Fingerabdruck — **nie Werte** | 36 Monate (Monatsdateien) |
| Anmelde-Protokoll (`anmeldungen`) | Zeit, Konto, Gerät, **gekürzte** IP (/24), Erfolg | letzte 300 Einträge |
| ZOE-Entscheidungen / -Protokoll | Freigaben/Ablehnungen mit Person; Protokoll nur Kennungen + Feldnamen | 36 Monate / 90 Tage |
| Löschprotokoll (`crm-loeschprotokoll`) | Protokoll-ID `lp-…`, Tag, Grund, wer — nie die Kennung | — [[KEVIN: Frist festlegen]] |
| Übergabe-Journal | Übermittlungen an Kunden (Empfänger, Anzahl, Kennungen) | 36 Monate |
| Absichtsprotokoll | Mehr-Bestand-Vorgänge (Art. 17, Import …) bis zum Abschluss | fertige nach 30 Tagen weg |
| Sicherungsstatus `daten/system/sicherung.json` | nur Zahlen und Dateinamen | laufend überschrieben |
| Docker-Logs | App/Arbeiter/Caddy, je Dienst 3 × 10 MB; keine Mail-Inhalte, keine Tokens (Regel im Code); Caddy ohne Zugriffs-Log | rollierend |

### 2.6 Auftragskontrolle (Dienstleister)

Eingesetzte und vorgesehene Dienstleister stehen in `AVV_VORLAGE.md` › Anlage 2. **IST:** Verträge zur Auftragsverarbeitung
sind **nicht nachgewiesen abgeschlossen**. [[KEVIN: AVV/DPA je Anbieter abschließen bzw. bestätigen und ablegen — Hetzner,
Google Workspace, Microsoft 365, Anthropic, GitHub, Telegram (falls genutzt), Newsletter-Dienst (noch nicht gewählt)]]
KI-Abschrift von Sprachnotizen bleibt **aus**, bis AVV/Drittland geklärt sind (`TRANSKRIPTION_AN`).

### 2.7 Verfügbarkeitskontrolle

- **Nachtsicherung** 03:15 (`deploy/sicherung.sh`): Schreibpause ≤ 30 s → Schnappschuss → **jeder Bestand wird entschlüsselt,
  geparst, gezählt** → tar.gz → Verschlüsselung (age bzw. Übergang, siehe 2.9) → Kopf/Dateizahl geprüft → Generationen
  **14 täglich / 8 wöchentlich / 12 monatlich** (`deploy/generationen.sh`). Fällt nie ganz aus (einzelne unlesbare Dateien →
  Archiv trotzdem, Status „teilweise“). **Nie unverschlüsselt.**
- **Zweiter Ort:** der Mac holt täglich ab (gleiche Generationen); **dritter Ort:** Hetzner-Abbilder (7 täglich).
- **Tageskopie** je Bestand vor dem ersten Überschreiben des Tages (14 Tage); Kalender-Tagessicherung je Kalender (14 Tage, nicht im Nachtarchiv).
- **Dead-Man-Ping** an Healthchecks (nur bei Erfolg); fehlt die Ping-Adresse, zeigt der Head of IT eine Pflicht-Warnung.
  [[KEVIN: Ist `.healthchecks-sicherung` am Server eingerichtet?]]
- Ziele: **RPO 24 h, RTO 4 h** (`NOTFALL.md`).
- Container: Neustart-Regel, Healthcheck, Speichergrenzen (Summe < RAM), geordnetes Beenden (60 s, ab +20 s 503 statt halber Schreibung).
- Absichtsprotokoll: abgebrochene Mehr-Bestand-Vorgänge werden beim Start/Takt fertiggestellt.
- **Grenze:** ein einzelner Server (1 vCPU, 1,9 GB RAM), keine Redundanz/Hochverfügbarkeit.

### 2.8 Trennungskontrolle

- Instanz-Trennung (Ziel für Kunden): eigener Container, Datenordner, Datenschlüssel, Pepper, age-Empfänger, Domain je Instanz.
  **Testkunden nie auf der Inhaber-Instanz** (Plattform-Regel).
- Innerhalb einer Instanz: Haushalte, Personen-Speicher (`…--<person>`), Sichten Privat/Business serverseitig, Gesellschaften.
- Demo-Instanz: eigener Datenordner, Riegel gegen `.data`, nur `@example.invalid`-Konten (`lib/demo/schutz.ts`).
- Entwicklung/Test getrennt von Produktion: Tests mit eigenem Datenordner (`MAKE_OS_DATEN_DIR`), Bau auf `entwicklung`, online nur `main`.
- Bekannte Grenze: die Software ist noch auf einen Haushalt zugeschnitten; feste Personen-Kennungen und Rückfälle sind nicht
  vollständig neutralisiert (`PLATTFORM_PLAN.md` › Paket 1). Deshalb **keine fremden Konten auf einer Instanz**.

### 2.9 Verschlüsselung (Art. 32 Abs. 1 lit. a)

| Was | Verfahren | Schlüssel liegt | Status |
|---|---|---|---|
| Alle Bestände im Ruhezustand (`/srv/make-os/daten`) | **AES-256-GCM** je Datei (`lib/store/local-db.ts`, `huelle.mjs`). Standard „kompatibel“ = Hülle v1; `MAKE_OS_FORMAT=v2` = mit Schlüssel-ID und AAD (Bestandsname). Klartext bei gesetztem Schlüssel wird abgelehnt. | Server: Schlüssel-Datei `/srv/make-os/schluessel/daten` (0400) **oder** `.env`; Kopie im Passwort-Manager + Papier | umgesetzt; v2 und Schlüssel-Datei: [[KEVIN: Stand am Server bestätigen]] |
| Dateiablage (Verträge, Fotos, Sprachnotizen) | AES-256-GCM („MKOSDAT1/2“) | wie oben | umgesetzt |
| OAuth-Tokens (Google, Microsoft, Whoop) | in verschlüsselten Beständen | wie oben | umgesetzt |
| Offline-Warteschlange im Browser (Netzwerken) | AES-GCM, nicht exportierbarer WebCrypto-Schlüssel, 30 Tage Höchstalter | Browser | umgesetzt |
| **Nachtarchive** | **age** (öffentlicher Schlüssel am Server, privater nur beim Inhaber) — **Übergang:** ohne age `openssl enc -aes-256-cbc -pbkdf2` mit Passwortdatei `/srv/make-os/.sicherung-passwort` | age: Identität nur offline; openssl: **Passwort liegt auf demselben Server** | **teilweise** — age am Server ist laut README noch einzurichten; bis dahin schützt die äußere Hülle nicht gegen einen Angreifer mit Server-Zugriff |
| Transport | TLS 1.2+/1.3 (Caddy), HSTS | — | umgesetzt |
| **Nicht** verschlüsselt im Ruhezustand | Brain-Index `brain-index.sqlite` (abgeleitet, nicht im Nachtarchiv), Bilder `bauplan-bilder`, Obsidian-Vault (`/srv/make-os/vault` + privates GitHub-Repo), Grabsteine (enthalten nur HMACs) | — | bewusst/offen (siehe Lücken) |
| Schlüsselwechsel | Rotation im laufenden Betrieb (`deploy/datenschluessel-rotieren-live.sh`), alter Schlüssel 15 Tage aufbewahren | — | umgesetzt (einmal am 26.09. mit Anhalten) |

**Wichtig (Bedrohungsmodell):** Ein Hetzner-Abbild enthält Daten **und** Schlüssel (Datei bzw. `.env`) — es ist so schutzwürdig
wie der Server selbst (`NOTFALL.md` › 4).

### 2.10 Pseudonymisierung und Datenminimierung (Art. 32 Abs. 1 lit. a, Art. 25)

- **HMAC-SHA-256 mit Pepper** (`MAKE_OS_PEPPER`, getrennt vom Datenschlüssel) für Sperrliste, Protokoll-Kennungen (`c2#…`) und
  Grabsteine — `lib/datenschutz/pepper.ts`. Ohne Pepper fällt es auf ungesalzenes v1 zurück (HOI gelb). [[KEVIN: Pepper am Server gesetzt?]]
- **Zufällige Kontakt-Kennungen** (`c-<uuid>`) statt E-Mail in Adressen, Protokollen, Läufen (Altbestand per Kennungs-Umzug umstellbar).
- Protokolle nur mit Kennungen und Feldnamen, nie Werten; IP-Adressen gekürzt; Telegram/Glocke ohne Namen.
- Fotos von Visitenkarten ohne Exif/GPS; KI-Pakete nur mit Arbeitsfeldern.
- Gesundheit: kein Gesundheitswert in der Kapazität gespeichert, nie im Business-Index (Prüfung S2).

### 2.11 Belastbarkeit (Art. 32 Abs. 1 lit. b)

Speichergrenzen je Container, Größenschranken je Route (413), Modell-Drossel je Person (429), Anmelde-Drosseln, nie still kürzen
(413 statt Datenverlust), Schreibsperren je Bestand, 409 bei veraltetem Stand, Schreibpause für stimmige Sicherungen,
Absichtsprotokoll. Docker-Härtung: `no-new-privileges`, alle Kernel-Fähigkeiten entfernt, Caddy-Bild per Hash festgelegt.

### 2.12 Wiederherstellung (Art. 32 Abs. 1 lit. c)

- Ganzes Archiv: `deploy/wiederherstellen.sh <archiv> <identität>` — hält App/Arbeiter an, legt den alten Ordner beiseite,
  **wendet die Grabsteine zwingend an** (gelöschte Personen kommen nicht zurück).
- Einzelne Datensätze: `scripts/einzel-wiederherstellen.mjs` (Vorschau nur mit Kennungen/Feldnamen, Grabsteine angewendet).
- Probe am Mac: `deploy/sicherung-probe.sh <archiv> <identität> --app` (misst RTO).
- **IST: Probe-Restore noch nie durchgeführt** (Tabelle in `DEPLOY.md` › Probe-Restore: „noch nie gemacht“). [[KEVIN: ersten
  Probe-Restore machen und eintragen; danach quartalsweise und nach jeder Schlüsselrotation]]
- Notfall-Ablauf „Server weg → läuft wieder“: `NOTFALL.md` (Schlüssel an drei Orten: zwei Passwort-Manager + Papier).

### 2.13 Regelmäßige Überprüfung (Art. 32 Abs. 1 lit. d)

| Prüfung | Wie oft | Wo |
|---|---|---|
| CI vor jedem Ausrollen: Typprüfung, Tests (inkl. Datenschutz-Wächter), Lint | jeder Push auf `main` | GitHub Action |
| Wächtertests Datenschutz (Speicher-Register, Rechte, Repo ohne Daten, Sicht-Trennung, Demo ohne echte Daten) | jeder Testlauf | `tests/datenschutz-register.test.ts`, `tests/sicher-s1.test.ts`, `tests/repo-sauber.test.ts`, `tests/demo.test.ts` u. a. |
| Head of IT (Lage, Sicherung, Abholung, CSP, Anmeldungen, Schreibformat, Pepper, Schlüssel) | täglich ab 07:45, stündlich auf neues Rot | `/os/hoi`, `lib/hoi/` |
| Durchsicht aller Bestände (lesbar?) | nächtlich ab 04:00 | `lib/store/durchsicht.ts` |
| Selbstprüfung DSGVO (VVT, Rechtsgrundlagen, Art. 13/14, Widersprüche, Fristen, Zugang) | aus den echten Beständen gerechnet | Markttraktion › Stammdaten › Datenschutz (`lib/crm/datenschutz.ts` `selbstpruefung`) |
| Abhängigkeiten | wöchentlich | Dependabot |
| Datenschutz-/Sicherheitsprüfungen von Hand | anlassbezogen (bisher S1 29.09., S2 04.10.) | `CLAUDE.md`, `DATENSCHUTZ_APP.md` |
| Probe-Restore | quartalsweise (**noch nie**) | `DEPLOY.md` |
| Notfall-Übung, Schlüssel an allen drei Orten | jährlich und nach Rotation | `NOTFALL.md` › 3 |
| Externer Sicherheitstest | **keiner** | — |

---

## 3 · Organisatorische Maßnahmen

| Maßnahme | IST | Status |
|---|---|---|
| Vertraulichkeit | Zugriff nur Inhaber-Haushalt (zwei Personen). Für Team-Mitglieder/Freie und Kunden-Support: schriftliche Verpflichtung auf Vertraulichkeit fehlt (Art. 28 Abs. 3 lit. b, Art. 29). [[KEVIN: wer wird verpflichtet?]] [[ANWALT: Vorlage Verpflichtungserklärung]] | offen |
| Geheimnisse | Nur Orte im Repo, nie Werte; Schlüssel nie über Chat/KI-Assistenten; Passwort-Manager beider Personen + Papier im Tresor (`NOTFALL.md`) | umgesetzt (Regel) |
| Freigabe von Änderungen | Zwei Stände (`entwicklung` → `main`), Ausrollen nur auf ausdrückliches Wort; Rückweg dokumentiert (`UPDATES.md`, `GO_LIVE_CHECKLISTE.md`) | umgesetzt |
| Datenschutz-Hinweise | Website-Erklärung als Entwurf (`website/datenschutz.html`), Hinweis der Anwendung als Entwurf (`DATENSCHUTZ_APP.md` › 4), Art.-13-Block in Danke-Mails und Buchung | teilweise |
| Verzeichnis (Art. 30) | in der App gepflegt (`lib/crm/datenschutz.ts`), nicht als Dokument abgelegt; Angabe „Verantwortlich“ uneinheitlich (ältere Einträge nennen eine Person/Altfirmen, neuere die GmbH) | teilweise |
| Datenpannen | Prozess: `DATENPANNEN.md` | Entwurf |
| Löschung | `LOESCHKONZEPT.md` + Läufe im Code | umgesetzt (Code) / Entwurf (Dokument) |
| KI-Kompetenz (Art. 4 KI-VO) | `KI_VO.md` | offen (Schulung) |
| Datenschutzbeauftragter | nicht benannt; Pflicht prüfen (§ 38 BDSG, siehe `DSFA.md`) [[ANWALT]] | offen |

---

## 4 · Lücken-Liste (nach Dringlichkeit)

| # | Lücke | Wirkung | Vorschlag | Wer |
|---|---|---|---|---|
| L1 | **age am Server nicht eingerichtet** → Nachtarchive nur mit openssl + Passwortdatei auf demselben Server | Wer den Server hat, hat auch die Archive im Klartext (innere AES-Hülle bleibt, deren Schlüssel liegt aber ebenfalls dort) | `UPDATES.md` › „Go-Live: VOR dem Upload am Server“ Schritt 2 | [[KEVIN]] |
| L2 | **Probe-Restore nie gemacht** | Wiederherstellbarkeit (Art. 32 Abs. 1 lit. c) unbewiesen, RTO unbekannt | `sicherung-probe.sh --app`, Ergebnis in DEPLOY.md | [[KEVIN]] |
| L3 | **2FA nicht erzwungen** | Ein geratenes/abgegriffenes Passwort reicht | Pflicht je Instanz (Konfiguration) — vor Kunden-Instanzen | [[KEVIN]] → Bau |
| L4 | **AVVs nicht nachgewiesen** (Hetzner, Google, Microsoft, Anthropic, GitHub, ggf. Telegram, Newsletter-Dienst) | Art. 28 verletzt, Drittland-Garantien unbelegt | abschließen/ablegen, Anthropic Zero-Retention anfragen | [[KEVIN]] |
| L5 | **Business-Termine teils noch in iCloud** (Verbraucherkonto, kein AVV) | Kein Auftragsverarbeitungsvertrag möglich | Business vollständig nach Google Workspace, iCloud nur Privat | [[KEVIN]] |
| L6 | **Telegram offen** — ohne Boten kommen Anmelde-Alarm und HOI-Rot nicht aufs Handy; mit Boten ein weiterer Drittland-Dienst | Erkennung von Vorfällen verzögert | Entscheidung: Telegram (Texte neutral, AVV-Lage klären) oder Alternative (Mail/Push) | [[KEVIN]] |
| L7 | Pepper, Schlüssel-Datei statt `.env`, `MAKE_OS_FORMAT=v2`, Healthchecks-Adresse — Stand am Server nicht im Repo belegt | Schwächere Pseudonymisierung / Schlüssel in `docker inspect` sichtbar / keine AAD | HOI-Befunde ablesen und abarbeiten | [[KEVIN]] |
| L8 | `sudo` ohne Passwort für `make` | SSH-Schlüssel = root | sudo mit Passwort oder Hardware-Schlüssel für SSH | [[KEVIN]] |
| L9 | Unverschlüsselt im Ruhezustand: Vault (Server + GitHub inkl. Historie), Bauplan-Bilder, Brain-Index | Notizen/Bilder können Personendaten tragen | Vault-Inhalte prüfen, Bauplan-Bilder in die verschlüsselte Ablage, Brain-Index im verschlüsselten Volume | Bau / [[KEVIN]] |
| L10 | Hetzner-Abbilder enthalten Daten + Schlüssel | Kompromittiertes Hoster-Konto = Klartext | 2FA am Hoster, Zugriff auf das Projekt minimal halten, Schlüssel nur als Datei mit getrenntem Volume prüfen | [[KEVIN]] |
| L11 | Mac als Sicherungsort ohne dokumentierte Geräteschutz-Maßnahmen | Verlust/Diebstahl des Mac | FileVault, Sperre, Notiz im Notfall-Dokument | [[KEVIN]] |
| L12 | Nur ein Server, 1 vCPU / 1,9 GB | Verfügbarkeit, Belastbarkeit | Server vergrößern (Empfehlung DEPLOY.md: 2 vCPU / 4 GB) | [[KEVIN]] |
| L13 | Kein externer Sicherheitstest, keine Schwachstellen-Meldestelle (`security.txt`) | — | einmaliger Test vor Kunden-Instanzen | [[KEVIN]] |
| L14 | scrypt mit Node-Standard (N = 2^14) unter heutiger OWASP-Empfehlung (2^17) | Offline-Raten bei gestohlenem Konten-Bestand leichter (Bestand selbst ist verschlüsselt) | Parameter erhöhen mit Umrechnung beim nächsten Login | Bau |
| L15 | Software noch nicht neutralisiert (feste Personen-Kennungen/Rückfälle) | Kunden-Instanzen nur eingeschränkt sicher betreibbar | `PLATTFORM_PLAN.md` Paket 1 vor echten Kundendaten | Bau |
| L16 | Support-Zugriff in Kunden-Instanzen nicht technisch protokolliert (nur SSH-Systemlog) | Nachweis gegenüber Kunden | Prozess `AVV_VORLAGE.md` › Anlage 3, später Werkzeug | Bau / [[KEVIN]] |
| L17 | Verpflichtung auf Vertraulichkeit, Geräteregel, DSB-Frage | organisatorisch | siehe Abschnitt 3 | [[KEVIN]] / [[ANWALT]] |
