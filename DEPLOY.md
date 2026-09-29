# MAKE OS gemeinsam betreiben

## ▶ Live gehen — die Schritte (vorbereitet 24.09. abends)

> **Stand 27.09. (nachgemessen per `nproc`/`free -m`):** der Server hat **1 vCPU und 1,9 GB RAM**, nicht CX22. Alles pro Anfrage reiht sich auf einem Kern; Embeddings bleiben deshalb aus (`lib/brain/einbettung.ts embeddingsErlaubt`), der Arbeiter fährt zwei Läufe. Empfehlung: auf 2 vCPU / 4 GB heben.


Alles Technische liegt im Repo: `Dockerfile`, `compose.yml` (App, Arbeiter,
Caddy mit HTTPS), `deploy/` (Einrichtung, Datenumzug, Sicherung, Vault-Abgleich,
Zulieferer) und `.github/workflows/pruefen-und-ausrollen.yml`. Der
Produktions-Build läuft (geprüft 24.09.).

**Kevin (je einmal, im Browser — ca. 20 Minuten):**
1. **GitHub:** zwei private Repos anlegen, ohne README: `make-os` (Code) und
   `make-vault` (Obsidian-Hirn). SSH-Schlüssel des Macs hinterlegen, falls noch nicht.
2. **Hetzner:** Cloud-Server CX22, Falkenstein, Ubuntu 24.04, SSH-Schlüssel des Macs → IP an Claude.
3. **Adresse:** Domain oder Subdomain festlegen, A-Eintrag auf die Server-IP.

**Claude (ca. 45 Minuten, mit Kevin am Bildschirm):**
1. Code nach `make-os` pushen.
2. Auf dem Server: `bash server-einrichten.sh <repo>` → Deploy-Schlüssel in beide Repos eintragen.
3. `.env` aus `deploy/env.server.beispiel` — neue Schlüssel (`openssl rand -hex 32`).
4. Vault: `bash deploy/vault-hochladen.sh` (Kevin selbst, am Mac — legt `.gitignore` an,
   `git init`, pusht nach `make-vault`); auf dem Server nach `/srv/make-os/vault` klonen.
5. `bash deploy/daten-hochladen.sh <server>` — **ab da nur noch online arbeiten.**
6. `docker compose up -d --build` → Adresse öffnen, anmelden, Stichproben.
7. GitHub-Secrets `MAKE_OS_HOST`, `MAKE_OS_SSH_KEY` → jeder Push rollt geprüft aus.
8. Mac: `~/.make-os/zulieferer.env` anlegen, Zulieferer als Hintergrunddienst
   (`deploy/de.makeos.zulieferer.plist`), Vault-Abgleich per Cron.
9. Malin einladen (Konto → Einladung), Haushalt „kevin-malin“ zuweisen.

**Mac liefert zu (Kevins Entscheidung):** Kalender, Mail, Erinnerungen und
Kontakte liest nur der Mac. Auf dem Server zeigen die Apple-Routen den zuletzt
zugelieferten Stand (Kopfzeile `X-Stand`); Termin anlegen und Mail-Entwürfe
gehen nur am Mac. Die lokale Instanz dient danach NUR noch als Zulieferer.


Was wohin gehört, damit Kevin und Malin zusammen arbeiten können — und was
bewusst **nicht** über iCloud läuft.

## Die vier Ebenen (jede hat ihren Ort)

| Was | Wo | Warum dort |
|---|---|---|
| **Code** | GitHub, privates Repo | Zwei Leute ändern gleichzeitig — nur Git kann das zusammenführen |
| **Daten** (Aufgaben, Netzwerk, Finanzen …) | `.data/` als Volume auf dem Hetzner-Server | Ein Stand für beide, gleichzeitig nutzbar |
| **Dokumente** (Belege, PDFs, Screenshots) | gemeinsamer iCloud-Ordner | Genau dafür ist iCloud gut |
| **Arbeitsregeln für Claude** | `CLAUDE.md` im Repo | Reist mit dem Code mit, jedes Claude liest sie |

## Warum Code und Daten NICHT in iCloud gehören

Es liegt nahe, den Projektordner einfach in den gemeinsamen iCloud-Ordner zu
legen. Das geht schief, und zwar zuverlässig:

1. **`node_modules`** enthält über hunderttausend kleine Dateien. iCloud
   synchronisiert sich daran tot und lädt Dateien bei Bedarf nach — der
   Server startet dann nicht, weil eine Datei gerade „in der Cloud" ist.
2. **Git bricht.** Die `.git`-Ablage verträgt keine zwei Rechner, die
   gleichzeitig hineinschreiben. Ein halb synchronisierter Stand kann die
   ganze Historie beschädigen.
3. **Gleichzeitiges Speichern erzeugt Konfliktdateien** statt einer
   Zusammenführung — bei den Datendateien hieße das: einer von beiden
   verliert seine Eingaben, ohne es zu merken.

Für **Dokumente** ist iCloud dagegen genau richtig: Belege, Verträge,
Screenshots. Die Ordnerstruktur dafür steht als Punkt im Bauplan.

## Die Reihenfolge (was zuerst)

### 1 · GitHub — der gemeinsame Code
Nur Kevin, einmalig, im Browser:
- SSH-Schlüssel des Macs bei GitHub hinterlegen (Settings → SSH and GPG keys)
- Privates Repo `make-os` anlegen, ohne README
- Danach pusht Claude den Stand und lädt Malin als Mitarbeiterin ein

### 2 · Hetzner — der gemeinsame Server
Nur Kevin, einmalig:
- Konto auf hetzner.com, Cloud-Server **CX22**, Standort **Falkenstein**,
  Ubuntu 24.04, beim Anlegen denselben SSH-Schlüssel hinterlegen
- Server-IP an Claude geben

### 3 · Einrichtung (übernimmt Claude)
Nach PLAN.md, Phase 1 — bewusst **ohne** Postgres und Coolify (Stand 18.09.):
- `Dockerfile` + `compose.yml`: App, Arbeiter, Caddy (HTTPS von allein),
  Volume für `.data` und den Vault
- Deploy per GitHub Action: Push auf `main` → Server zieht → `docker compose up -d --build`
- `.data/` einmalig übertragen, nächtliche verschlüsselte Sicherung
- Hinter Caddy: `MAKE_OS_ADRESSE=https://<Domain>` und
  `MAKE_OS_INTERN=http://localhost:3000` setzen (siehe `lib/innen.ts`)
- **Offen, Kevins Entscheidung:** wie das Obsidian-Brain auf den Server kommt
  (Plan: eigenes Git-Repo für den Vault). Damit lägen auch private Notizen
  beim Anbieter.

### 4 · Malins Einstieg
- **Nutzen:** Adresse im Browser öffnen, Schlüssel von Kevin persönlich
- **Mitbauen:** Repo klonen, `npm install`, eigene `.env.local`, Claude Code
  im geklonten Ordner öffnen — die `CLAUDE.md` bringt ihm alle Regeln bei
- Details in `ONBOARDING_MALIN.md`

## Zum „geteilten Projekt bei Claude"

Ein gemeinsames Claude-Projekt im Sinne eines geteilten Gedächtnisses gibt es
nicht — jedes Claude arbeitet auf seinem Rechner mit seinem eigenen
Verlauf. Geteilt wird über den Code: Die `CLAUDE.md` im Repo enthält alle
Regeln, Begriffe und Leitplanken. Wer den Ordner öffnet, dessen Claude kennt
sie sofort. Das ist der belastbarste gemeinsame Kontext, den es gibt — er
altert nicht und geht nicht verloren.

## Bis der Server steht: Tailscale (seit 24.09.)

Kein WLAN zu Hause, nur Handy-Hotspot — deshalb Tailscale als Brücke. Malin
erreicht Kevins Mac über ein privates, verschlüsseltes Netz, von überall.

**Kevin, einmalig am Mac:**
1. Tailscale aus dem Mac App Store installieren, öffnen, anmelden.
2. Unter login.tailscale.com/admin → **DNS**: MagicDNS an, **HTTPS
   Certificates** aktivieren.
3. Unter **Machines** beim Mac → **Share** → Malins E-Mail. Sie sieht so nur
   diesen Mac, nicht dein ganzes Netz.
4. Im Terminal einmal (macht MAKE OS unter HTTPS im Tailnet erreichbar, bleibt
   nach Neustart bestehen):
   `/Applications/Tailscale.app/Contents/MacOS/Tailscale serve --bg 3001`
5. Die ausgegebene Adresse (`https://….ts.net`) in `.env.local` als
   `MAKE_OS_ADRESSE` eintragen, MAKE OS neu starten.
6. System → Konto → „Jemanden einladen" → Link an Malin.

HTTPS ist Pflicht, nicht Kür: ohne sichere Verbindung gibt Safari kein
Mikrofon frei (ZOE per Sprache) und legt keine App auf den Home-Bildschirm.

**Grenze:** Malin ist nur drin, solange der Mac läuft, MAKE OS gestartet ist
und der Mac online ist. Deckel zu heißt: Mac schläft, Malin draußen.

## Härtung (Audit 26.09.)

Was im Repo steht und mit dem nächsten Ausrollen wirkt:
- **Container:** `no-new-privileges`, alle Kernel-Fähigkeiten weg (Caddy behält `NET_BIND_SERVICE`), Speichergrenzen;
  der Arbeiter bekommt nur `MAKE_OS_KEY` statt der ganzen `.env`.
- **Kopfzeilen aus der App** (`next.config.mjs`): X-Content-Type-Options, Referrer-Policy, X-Frame-Options,
  Permissions-Policy; im Produktionsbau eine Content-Security-Policy (`default-src 'self'` …). Caddy setzt
  zusätzlich HSTS. Der Altbestand `/finanz-dashboard.html` bleibt ohne CSP (lädt Firebase).
- **Sitzungen:** 14 Tage; Abmelden widerruft den Zettel; „Alle anderen Geräte abmelden“ unter Konto;
  Passwortwechsel meldet andere Geräte ab; Anmelde-Protokoll unter Konto („Zuletzt: …“).
- **Ausrollen:** `deploy/ausrollen.sh` ist der Forced Command des Ausroll-Schlüssels (nur `git merge --ff-only`
  + `docker compose up -d --build`). In `/home/make/.ssh/authorized_keys` muss die Zeile so aussehen:
  `command="/srv/make-os/app/deploy/ausrollen.sh",restrict ssh-ed25519 AAAA… make-os-ausrollen`
- **Sicherung:** `/srv/make-os/sicherung.pub` (öffentlicher age-Schlüssel) ist seit 29.09. **Pflicht** — ohne sie bricht
  `deploy/sicherung.sh` ab (kein openssl-Rückfall mehr); entschlüsseln kann nur, wer die age-Identität hat. Erzeugen
  auf dem Mac: `age-keygen -o ~/make-os-sicherung.txt` (Datei in beide Passwort-Manager + Papier, NOTFALL.md), die
  Zeile `age1…` nach `/srv/make-os/sicherung.pub`. Zweiter Ort: der Mac holt jede Nacht ab (Abschnitt „Sicherung,
  Offsite, Wiederherstellung“).
- **SSH:** `server-haerten.sh` setzt `PermitRootLogin no`, sobald `make` einen Schlüssel und sudo hat
  (`server-einrichten.sh` richtet beides ein); `AllowTcpForwarding no`; Sicherheitsupdates explizit täglich.

Einmalig auf dem Server (als root, lesend prüfen, dann ausführen):
```bash
chmod 600 /srv/make-os/app/.env /srv/make-os/.sicherung-passwort
echo 'make ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/make && chmod 440 /etc/sudoers.d/make
bash /srv/make-os/app/deploy/server-haerten.sh
```

Bei GitHub (Kevin, im Browser): Branch-Schutz für `main` (kein Force-Push), 2FA für beide Konten,
Dependabot-PRs wöchentlich ansehen. Hetzner: Backups im Server-Menü aktiv lassen.

## Verschlüsselung im Ruhezustand (26.09.)

Alle Sammlungen in `/srv/make-os/daten` (und die Tagessicherungen darin) liegen als AES-256-GCM-Hülle, sobald in
`/srv/make-os/app/.env` der Schlüssel steht:

```
MAKE_OS_DATEN_SCHLUESSEL=<64 Hex-Zeichen, openssl rand -hex 32>
```

Einschalten (einmalig, als `make`): Schlüssel in die `.env`, `docker compose up -d` (App und Arbeiter lesen die
neue Umgebung), dann `docker compose exec -T app node scripts/daten-verschluesselung.mjs --verschluesseln`.
Ab da schreibt die App nur noch verschlüsselt; Klartext von früher wäre sonst noch lesbar geblieben.

**Der Schlüssel gehört in den Passwort-Manager** (Zeile aus der `.env` kopieren). Geht er verloren, sind Daten
UND Sicherungen unlesbar — die nächtliche Sicherung packt die verschlüsselten Dateien (zweite Hülle: Sicherungs-
Passwort bzw. age). Zurückholen braucht deshalb beides: Sicherung entpacken, `.env` mit dem Datenschlüssel,
fertig — oder zum Umzug einmal `--entschluesseln`.

**Hülle seit 29.09. (Paket D-A):** v2 mit Schlüssel-ID und AAD (Bestandsname trägt den Haushalt) — eine unter fremdem
Namen zurückgespielte Datei scheitert laut. v1-Hüllen bleiben lesbar und werden beim nächsten Schreiben v2. Klartext
bei gesetztem Schlüssel wird abgelehnt (HOI rot „Klartext-Bestand abgelehnt“); nur für eine bewusste Übernahme
`MAKE_OS_KLARTEXT_MIGRATION=1` setzen, danach wieder entfernen.

**Schlüssel als Datei statt in der Umgebung (empfohlen, #50):** in der `.env` sieht ihn `docker inspect` und jeder mit
Docker-Zugriff. Umstellen (als make, eigene Terminal-App):
```bash
sudo install -d -m 700 -o make -g make /srv/make-os/schluessel
grep '^MAKE_OS_DATEN_SCHLUESSEL=' /srv/make-os/app/.env | cut -d= -f2- > /srv/make-os/schluessel/daten
chmod 400 /srv/make-os/schluessel/daten
sed -i '/^MAKE_OS_DATEN_SCHLUESSEL=/d' /srv/make-os/app/.env      # erst NACH dem Schreiben der Datei
cd /srv/make-os/app && docker compose up -d                          # compose bindet /srv/make-os/schluessel nur lesend ein
```
Danach zeigt der HOI „Datenschlüssel“ nicht mehr gelb. Die Umgebung ginge der Datei vor — deshalb die Zeile entfernen.

**Rotieren im laufenden Betrieb (seit 29.09., braucht die Schlüssel-Datei):** `bash /srv/make-os/app/deploy/datenschluessel-rotieren-live.sh`
als `make` — kein Anhalten, nie Klartext auf der Platte: der alte Schlüssel wandert nach `schluessel/daten-alt` (nur
lesen), ein neuer nach `schluessel/daten`, die App stellt Bestand für Bestand in dessen Schreibsperre um (Bestände,
Tagessicherungen, Archiv, Dateiablage); erst bei 0 Fehlern verschwindet `daten-alt`. Bricht es ab: `… --weiter`.

**Rotieren mit Anhalten** (Notweg, ohne Schlüssel-Datei): `bash /srv/make-os/app/deploy/datenschluessel-rotieren.sh` als `make` —
eine Minute Unterbrechung, danach den neuen Schlüssel in der eigenen Terminal-App auslesen (nie über Claude oder
in einen Chat: alles, was dort steht, gilt als kompromittiert). Am 26.09. einmal so gemacht.
**Den alten Schlüssel aufbewahren** (seit 28.09. sagt das Skript es am Ende deutlich): Tagesarchive (14 Tage) und
Hetzner-Abbilder (7 Tage) von vor der Rotation sind mit dem ALTEN Schlüssel verschlüsselt. Im Passwort-Manager den
alten Eintrag umbenennen („… ALT — rotiert am …, aufbewahren bis …“), nicht überschreiben; erst nach 15 Tagen löschen.
Achtung: Die Archive von vor dem 26.09. brauchen den Schlüssel von vor der Rotation am 26.09.

### Probe-Restore — quartalsweise (seit 28.09.)
Eine Sicherung zählt erst, wenn sie einmal zurückgeholt wurde. Einmal im Quartal (und nach jeder Schlüsselrotation)
am Mac: ein Tagesarchiv aus `~/MAKE-OS-Sicherungen` nehmen und `deploy/sicherung-probe.sh <archiv> <age-schlüssel> --app`
laufen lassen (`brew install age` einmal vorher; `--app` startet MAKE OS im Probe-Ordner auf Port 3098 und misst die
Wiederherstellungszeit — Ziel RTO 4 h, siehe NOTFALL.md) —
den Datenschlüssel vorher nur in die Umgebung (`read -rs MAKE_OS_DATEN_SCHLUESSEL && export MAKE_OS_DATEN_SCHLUESSEL`),
nie in eine Datei. Das Skript entschlüsselt in einen Temp-Ordner, zählt Bestände und Datensätze je Bestand (nur
Zahlen, keine Inhalte), prüft die Dateiablage und löscht den Temp-Ordner. „Probe bestanden“ + Datum hier eintragen:

| Datum | Archiv | Bestände | Dauer bis „App antwortet“ | Ergebnis |
|---|---|---|---|---|
| — | — | — | — | noch nie gemacht |

Im Ruhezustand NICHT verschlüsselt (bewusst, Stand 29.09.): Bilder unter `daten/bauplan-bilder`, der Brain-Index
`daten/brain-index.sqlite` (abgeleitet, wird neu gebaut — seit 29.09. nicht mehr in der Nachtsicherung) und das
Obsidian-Hirn (eigenes Git-Repo). Das Archiv `daten/archiv` ist seit 28.09. verschlüsselt (lib/store/archiv.ts).
Die Nachtarchive selbst sind als Ganzes mit age verschlüsselt.

## Sicherung, Offsite, Wiederherstellung (29.09., Paket D-A)

**Ziele:** RPO 24 h (Nachtarchiv 03:15 + Tageskopie je Bestand vor dem ersten Überschreiben des Tages), RTO 4 h
(NOTFALL.md, gemessen mit `sicherung-probe.sh --app`). Löschkonzept: Sicherungen sind „beyond use“ und laufen nach
den Generationen unten ab (längstens 12 Monate). Offen (#70): Grabsteine, die eine Wiederherstellung automatisch um
spätere Art.-17-Löschungen bereinigen — bis dahin nach einem Restore das Löschprotokoll der Zwischenzeit von Hand nachziehen.

**Ablauf der Nachtsicherung** (`deploy/sicherung.sh`, Cron 03:15 als make): Schreibpause ≤ 30 s über
`POST /api/intern/schreibpause` (Dienstweg im Container) → Schnappschuss nach `daten/.sicherung-stage` (ohne
`backup/`, Brain-Index, `.tmp`) → Pause aufheben → jeden Bestand entschlüsseln/parsen/zählen
(`scripts/sicherung-pruefen.mjs` im Container) → tar.gz → age → Kopf und Dateizahl prüfen → Generationen.
Immer (auch bei Fehlern): `daten/system/sicherung.json` (nur Zahlen) für den Head of IT und der Dead-Man-Ping.

**Generationen** (Server `sicherungen/` und Mac `~/MAKE-OS-Sicherungen`, `deploy/generationen.sh`): 14 täglich,
8 wöchentlich (neuestes je Kalenderwoche), 12 monatlich (neuestes je Monat).

**Einmal einrichten (Server, als make):**
```bash
echo 'https://hc-ping.com/<eure-uuid>' > /srv/make-os/.healthchecks-sicherung   # Pflicht (HOI gelb, solange es fehlt)
sudo install -m 644 /srv/make-os/app/deploy/logrotate-make-os /etc/logrotate.d/make-os
```
Healthchecks.io: Prüfung „MAKE OS Sicherung“, Zeitraum 1 Tag, Kulanz 2 h; Benachrichtigung an Kevin + Malin.

**Mac-Abholung** (Kevin: „Auf euren Mac ziehen“) — nur lesend, Pull vom Mac:
1. Am Mac: `deploy/sicherung-abholen.sh --einrichten` → erzeugt `~/.ssh/make-os-abholung` und zeigt eine Zeile.
2. Auf dem Server diese Zeile in `/home/make/.ssh/authorized_keys` (Forced Command, `restrict`):
   `command="/srv/make-os/app/deploy/sicherung-ausgeben.sh",restrict ssh-ed25519 AAAA… make-os-abholung` —
   der Schlüssel kann dann NUR `liste`, `holen <archiv>` und `bestaetigen <archiv> <sha256>`.
3. Am Mac: `cp deploy/de.makeos.sicherung.plist ~/Library/LaunchAgents/ && launchctl load ~/Library/LaunchAgents/de.makeos.sicherung.plist`
   (täglich 08:30; verpasste Läufe holt launchd beim Aufwachen nach). Einmal von Hand: `deploy/sicherung-abholen.sh`.
Der Mac prüft Größe + SHA-256 und bestätigt; der Server schreibt `daten/system/abholung.json`, der Lage-Sammler meldet
das Alter → HOI „Sicherung am Mac“ (> 48 h rot). Der Server kann den Mac nie erreichen und dort nichts löschen.

**Einzelne Datensätze zurückholen** (statt Dateitausch per SSH): `docker compose exec -T app node scripts/einzel-wiederherstellen.mjs <bestand>`
(Tageskopien) → `… <bestand> <tag>` (Vorschau: geändert/gelöscht/neu je Liste, nur Kennungen und Feldnamen) →
`… <bestand> <tag> <liste> <id> …` (übernimmt genau diese, mit Stand-Prüfung und Protokoll). Gelöschte Personen holt
das Werkzeug nie zurück (Art. 17 möglich). Route: `/api/intern/wiederherstellen` (nur Inhaber).

## Datenschutz: Pepper und Grabsteine (29.09., Paket D-B — erst auf Kevins Wort am Server)

- **Pepper** (`MAKE_OS_PEPPER`, HMAC für Sperrliste, Protokoll-Kennungen, Grabsteine): einmal `openssl rand -hex 32`
  (Terminal, nie über Chat/Claude), in `/srv/make-os/app/.env` eintragen und in beide Passwort-Manager + Papier (wie der
  Datenschlüssel). **Nie wechseln.** Alternativ als Datei (`MAKE_OS_PEPPER_DATEI`, 0400). Ohne Pepper: gelber HOI-Befund.
  Nach dem Setzen rechnet der nächste Löschfristen-Lauf die Fingerabdrücke existierender Kontakte einmal um.
- **Grabsteine** außerhalb des Datenordners: seit Paket D-C steht das Volume in `compose.yml` (Dienst `app`:
  `- ${MAKE_OS_GRABSTEINE:-/srv/make-os/grabsteine}:/grabsteine` und `MAKE_OS_GRABSTEINE_DIR: /grabsteine`; der Arbeiter
  braucht es nicht). **VOR dem Upload** einmal den Ordner mit den richtigen Rechten anlegen — sonst legt Docker ihn als root
  an und die App (UID 1000) kann keinen Grabstein schreiben (Art. 17 meldet dann „Grabstein nicht geschrieben“):
  `sudo install -d -m 700 -o make -g make /srv/make-os/grabsteine`. Neue Server: `deploy/server-einrichten.sh` legt ihn an.
  `deploy/sicherung.sh` packt den Ordner mit ins Nachtarchiv.
- **Zurückspielen** eines ganzen Archivs nur mit `deploy/wiederherstellen.sh <archiv> <identität>`: hält App und Arbeiter
  an, legt den alten Datenordner beiseite, lässt den Grabstein-Ordner stehen, startet die App und wendet die Grabsteine
  zwingend an (sonst bleibt der Arbeiter aus). Einzel-Restore (`scripts/einzel-wiederherstellen.mjs`) wendet sie selbst an.

## Kennungs-Umzug nach dem Upload (Paket D-C #35 — nur auf Kevins Wort, nie automatisch)

Neue Kontakte bekommen ab dem Upload `c-<uuid>`. Der Altbestand trägt weiter Kennungen aus E-Mail bzw. Name, bis Kevin
den Umzug startet:
1. **Vorher:** die Nachtsicherung des Tages ist durch (HOI „Sicherung geprüft“ grün) — die App legt zusätzlich eine
   Archivkopie aller betroffenen Bestände an (`archiv/crm-vor-kennungen-umzug-<zeit>.json`, 30 Tage).
2. Stammdaten › Datenqualität › **Kontakt-Kennungen** (nur Inhaber): die Vorschau zeigt Anzahl, Bestände und je Person,
   wo ihre Kennung steht — sie schreibt nichts.
3. Wenn gerade niemand im CRM arbeitet: **Umstellen …** → bestätigen. Dauert Sekunden (500 erfundene Kontakte mit Verweisen in allen Speichern: ~0,6 s am Mac).
   Offene Fenster anderer Geräte einmal neu laden (sie halten noch alte Kennungen; ein Schreiben damit endet in 409 +
   „neu laden“).
4. Danach: alte Links (Notizen im Vault, Lesezeichen, `?k=`/`?kontakt=`) leiten weiter; HOI „Abgebrochene Vorgänge“ grün.
   Bricht der Lauf ab (Deploy, Absturz), setzt ihn der Start/Takt fort — oder „Umzug fortsetzen …“ auf der Karte.
5. **Rückweg** (Karte „Rückweg …“) geht nur, solange kein umgezogener Kontakt seitdem geändert, gelöscht oder
   zusammengeführt wurde — sonst 409 mit Grund; danach leitet die Tabelle neue Kennungen auf die alten zurück.
Per Kommandozeile (Dienstweg ist bewusst NICHT erlaubt — der Umzug steht mit der Person im Protokoll): nur über die Oberfläche.

## Ausrollen seit 26.09. abends: Bild kommt fertig von GitHub
Die Action baut das Docker-Image auf dem GitHub-Rechner (`docker build`) und schickt es per SSH-Stdin an den Server
(`docker save | gzip | ssh make@… bild`). `deploy/ausrollen.sh` (Forced Command) unterscheidet über
`SSH_ORIGINAL_COMMAND`: `ziehen` (nur `git merge --ff-only`), `bild` (Stdin → `docker load` → `compose up --no-build`),
leer = Altweg (ziehen + auf dem Server bauen). Die Action prüft an der Ausgabe `ausrollen-v2`, ob das neue Skript schon
auf dem Server liegt; sonst hat der Altweg gebaut. Vorteil: kein Bau auf dem 1-CPU-Server, die App bleibt beim Ausrollen
flott; Rückfall bleibt möglich (`ssh make@… ` ohne Modus).
