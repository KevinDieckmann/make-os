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

**Mac liefert zu (Kevins Entscheidung):** Erinnerungen und Kontakte liest nur der Mac (der Kalender kommt seit 25.09. direkt aus
iCloud). Auf dem Server zeigen die Apple-Routen den zuletzt zugelieferten Stand (Kopfzeile `X-Stand`). Die lokale Instanz dient danach
NUR noch als Zulieferer. **Mail seit 06.10. (Inbox 2) nicht mehr vom Mac:** der Server holt die Postfächer selbst — Gmail über die
Google-Verbindung, alle anderen per IMAP (Port 993, TLS) und SMTP (465/587) direkt beim Anbieter. Dafür braucht der Server ausgehend
nur diese Ports (ufw lässt Ausgehendes zu). Neue Pakete `imapflow`/`nodemailer` kommen über `npm ci` ins Bild; neue Umgebung nur optional:
`MAKE_OS_IMAP_IDLE=aus` (ohne IDLE-Verbindungen, Abfrage alle 2 Min.). Zugangsdaten der Postfächer trägt jede Person in der Inbox ein
(verschlüsselt im Datenordner) — nie in die `.env`.


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
  zusätzlich HSTS. Der frühere Altbestand `/finanz-dashboard.html` (ohne CSP) ist seit 08.10. entfernt — die CSP gilt für jede Seite.
- **Sitzungen:** 14 Tage; Abmelden widerruft den Zettel; „Alle anderen Geräte abmelden“ unter Konto;
  Passwortwechsel meldet andere Geräte ab; Anmelde-Protokoll unter Konto („Zuletzt: …“).
- **Ausrollen:** `deploy/ausrollen.sh` ist der Forced Command des Ausroll-Schlüssels (nur `git merge --ff-only`
  + `docker compose up -d --build`). In `/home/make/.ssh/authorized_keys` muss die Zeile so aussehen:
  `command="/srv/make-os/app/deploy/ausrollen.sh",restrict ssh-ed25519 AAAA… make-os-ausrollen`
- **Sicherung:** `/srv/make-os/sicherung.pub` (öffentlicher age-Schlüssel) + `age` auf dem Server sind der Normalweg —
  entschlüsseln kann nur, wer die age-Identität hat. Einrichten **vor** dem Upload (UPDATES.md › „Go-Live: VOR dem Upload
  am Server“): `apt-get install age` am Server, am Mac `age-keygen -o ~/make-os-sicherung.txt` (Datei in beide
  Passwort-Manager + Papier, NOTFALL.md), die Zeile `age1…` nach `/srv/make-os/sicherung.pub`. Fehlt age oder die Datei,
  sichert `deploy/sicherung.sh` mit dem bisherigen openssl-Weg und `/srv/make-os/.sicherung-passwort` (`.tar.gz.enc`,
  HOI rot „Übergangs-Verschlüsselung“, Ping als Fehler); fehlt auch das Passwort, bricht sie ab — nie unverschlüsselt.
  Zweiter Ort: der Mac holt jede Nacht ab (Abschnitt „Sicherung, Offsite, Wiederherstellung“).
- **SSH:** `server-haerten.sh` setzt `PermitRootLogin no`, sobald `make` einen Schlüssel und sudo hat
  (`server-einrichten.sh` richtet beides ein); `AllowTcpForwarding no`; Sicherheitsupdates explizit täglich.
- **Weiterer Admin-Schlüssel (09.10., R9 — zweite gleichwertige Inhaberin):** jede Inhaberin/jeder Inhaber kommt mit einem EIGENEN
  Schlüssel als `make` auf den Server (nie ein geteilter). Die neue Person erzeugt ihn am eigenen Rechner
  (`ssh-keygen -t ed25519 -C "<vorname>-make-os"`, mit Passphrase) und gibt nur die `.pub`-Zeile weiter; wer schon Zugang hat, trägt
  sie ein: `ssh -t make@<SERVER> bash /srv/make-os/app/deploy/ssh-schluessel-hinzufuegen.sh` (fragt die Zeile ab). Das Skript nimmt
  genau einen öffentlichen Schlüssel ohne Optionen, trägt keinen doppelt ein, lässt den Ausroll-Schlüssel (`command=…,restrict`)
  unberührt und schreibt atomar mit Rechten 600. `--liste` zeigt die Fingerabdrücke, `--entfernen "<Schlüssel>"` nimmt genau diesen
  wieder heraus (nie den letzten Admin-Schlüssel). Probe der neuen Person: `ssh make@<SERVER> 'sudo -n true && echo ok'`.

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
Namen zurückgespielte Datei scheitert laut. Welche Hülle geschrieben wird, entscheidet das Schreibformat (nächster
Absatz); gelesen werden immer v1 und v2. Klartext
bei gesetztem Schlüssel wird abgelehnt (HOI rot „Klartext-Bestand abgelehnt“); nur für eine bewusste Übernahme
`MAKE_OS_KLARTEXT_MIGRATION=1` setzen, danach wieder entfernen.

**Schreibformat `MAKE_OS_FORMAT` — Kompatibilitätsmodus (seit 29.09. abends):** der alte Online-Stand aeb4964 kennt nur
die v1-Hülle und „MKOSDAT1“ (eine v2-Hülle läse er still als Klartext-Objekt und überschriebe sie), prüft die Sperrliste
nur mit SHA-256 v1 und kennt das Feld `_v` nicht. Deshalb schreibt die App **ohne Variable (Standard) bzw. mit
`MAKE_OS_FORMAT=kompatibel`** genau im alten Format:
- Bestände, Tagessicherungen, Archiv: v1-Hülle `{ __verschluesselt: 1, iv, tag, daten }` (gleiche Schlüsselableitung wie
  aeb4964); eine gelesene v2-Hülle wird bei der nächsten Schreibung wieder v1. Kein `_v` auf der Platte.
- Dateiablage: „MKOSDAT1“ (v2-Dateien werden weiter gelesen).
- Sperrliste: neue Einträge tragen v1 UND v2 (mit Pepper), bestehende v1-Einträge werden nicht umgerechnet — die Sperre
  greift so auch im alten Stand. Grabsteine liegen außerhalb des Datenordners (der alte Stand ignoriert sie).
- Rotation im Betrieb und `scripts/daten-verschluesselung.mjs --verschluesseln` schreiben ebenfalls v1/„MKOSDAT1“.
- Der Head of IT zeigt gelb „Kompatibilitätsmodus — Rückweg zum alten Stand möglich; nach stabilen Tagen auf v2 umstellen“.

**Rückweg zum alten Stand, solange kompatibel** (App anhalten, altes Bild starten — NOTFALL.md › Rückweg): Seit dem
Upload von af4679a (hat den Kompatibilitätsmodus, liest Schlüssel-Datei und Schlüsselring) ist der Rückweg-Stand af4679a,
nicht mehr aeb4964; nur für einen Rückweg bis aeb4964 müsste der Schlüssel in der `.env` stehen und dürfte nicht rotiert sein. Was der alte Stand nicht kennt, geht beim Zurückgehen verloren bzw. wird ignoriert: neue Felder an
Aufgaben (Verlauf, Kommentare, Listen, Unteraufgaben, Papierkorb/Archiv — der alte Stand zeigt gelöschte/archivierte
Aufgaben wieder als offen und entfernt die neuen Felder bei seiner nächsten Schreibung), neue Aktivitätsfelder an
Kontakten (ZOE-Herkunft), Buchungsort `ug` (wird „privat“), Mandatsbezug an Meilensteinen; nach einem Kennungs-Umzug
funktionieren alte Links nicht mehr (die Daten selbst bleiben stimmig). Für einen sauberen Rückweg also keinen
Kennungs-Umzug im Kompatibilitätsmodus.

**Umstellen auf v2** (nach stabilen Tagen, nur auf Kevins Wort):
```bash
cd /srv/make-os/app
echo 'MAKE_OS_FORMAT=v2' >> .env          # bzw. eine vorhandene Zeile MAKE_OS_FORMAT=… ändern
docker compose up -d                       # App und Arbeiter lesen die neue Umgebung
# optional, damit sofort ALLES v2 ist (sonst stellt jede Schreibung ihren Bestand um):
docker compose stop app arbeiter
docker compose run --rm -T --no-deps app node scripts/daten-verschluesselung.mjs --verschluesseln </dev/null
docker compose up -d
```
Ab da schreibt die App v2 (Schlüssel-ID + AAD, „MKOSDAT2“, `_v`), rechnet die Sperrliste einmal je Pepper auf v2 um
(Löschfristen-Lauf) und der HOI zeigt „Schreibformat: v2“ grün. **Danach geht es zum alten Stand nur noch per Sicherung**
(von vor der Umstellung). Zurück in den Kompatibilitätsmodus (`MAKE_OS_FORMAT=kompatibel` + `--verschluesseln`) bringt die
Hüllen wieder auf v1, aber nicht umgerechnete Sperrlisten-Einträge und `_v` in nicht wieder geschriebenen Beständen zurück.

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

Im Ruhezustand NICHT verschlüsselt (bewusst): nur noch das Obsidian-Hirn (eigenes Git-Repo). Seit 05.10. (UPDATES.md): Bilder
(`daten/bilder-gerichte`, `daten/bauplan-bilder`) in der Hülle der Dateiablage; der Brain-Index liegt nur im tmpfs `/brain-index`
(compose.yml, 256 MB, nach jedem Start neu gebaut — ≈ 2–3 s CPU), ein alter `daten/brain-index.sqlite` wird beim Start überschrieben
und gelöscht (HOI „Brain-Index (Suche)“). Das Archiv `daten/archiv` ist seit 28.09. verschlüsselt (lib/store/archiv.ts).
Die Nachtarchive selbst sind als Ganzes mit age verschlüsselt.

## Sicherung, Offsite, Wiederherstellung (29.09., Paket D-A)

**Ziele:** RPO 24 h (Nachtarchiv 03:15 + Tageskopie je Bestand vor dem ersten Überschreiben des Tages), RTO 4 h
(NOTFALL.md, gemessen mit `sicherung-probe.sh --app`). Löschkonzept: Sicherungen sind „beyond use“ und laufen nach
den Generationen unten ab (längstens 12 Monate). Spätere Art.-17-Löschungen bereinigen die Grabsteine nach jeder
Wiederherstellung (Abschnitt „Datenschutz: Pepper und Grabsteine“, `deploy/wiederherstellen.sh`).

**Ablauf der Nachtsicherung** (`deploy/sicherung.sh`, Cron 03:15 als make): Schreibpause ≤ 30 s über
`POST /api/intern/schreibpause` (Dienstweg im Container) → Schnappschuss nach `daten/.sicherung-stage` (ohne
`backup/`, Brain-Index, `.tmp`) → Pause aufheben → jeden Bestand entschlüsseln/parsen/zählen
(`scripts/sicherung-pruefen.mjs` im Container) → tar.gz → age (ohne age: openssl-Übergang, siehe oben) → Kopf und
Dateizahl prüfen → Generationen. Ist bei der Prüfung eine einzelne Datei nicht lesbar (oder läuft die Prüfung nicht), wird
das Archiv trotzdem geschrieben — Status „teilweise“ mit den Dateinamen, HOI rot, Ping als Fehler.
Immer (auch bei Fehlern): `daten/system/sicherung.json` (Zahlen und Dateinamen, nie Inhalte) für den Head of IT und
der Dead-Man-Ping (Erfolg nur, wenn alles in Ordnung ist).

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
Update-Hinweis (08.10.): `ziehen` legt danach `<daten>/system/update.json` `{ seit, ziel }` ab, `bild` (bzw. der Altweg) entfernt sie nach
dem Tausch und bei jedem Abbruch — die App zeigt solange oben „Update läuft — kurz nichts Wichtiges speichern“ (ignoriert sie nach 20 Min.)
und danach „Neue Version da — neu laden“. Schreib-/Löschfehler halten das Ausrollen nie auf (`|| true`).

## Domain makeinnovation.de (01.10.2026)

Kevin hat `makeinnovation.de` bei IONOS gekauft. Ziel: die Software unter **app.makeinnovation.de**, auf
**makeinnovation.de + www** die Landingpage der MAKE Innovation GmbH mit „Anmelden“-Knopf — die geht aber erst online,
wenn Kevin sie gesehen und freigegeben hat (`website/LIESMICH.md`). Bis dahin leiten beide auf die Anmeldung um.
Die sslip-Adresse (`2-28-108-162.sslip.io`) bleibt als Rückfall bestehen.

**So ist es in Caddy verdrahtet**
- **Software:** Der Block heißt weiter `{$MAKE_OS_DOMAIN} { … }`. `MAKE_OS_DOMAIN` darf eine **kommagetrennte Liste**
  sein; auf dem Server steht seit 01.10. `MAKE_OS_DOMAIN="app.makeinnovation.de, 2-28-108-162.sslip.io"` in
  `/srv/make-os/app/.env`. `app.makeinnovation.de` steht deshalb **nicht** zusätzlich in der Caddyfile — dieselbe
  Adresse zweimal lässt Caddy nicht starten (Wächter: `tests/caddy-buchung-koepfe.test.ts`). Eine geänderte `.env`
  wirkt erst mit `docker compose up -d caddy` (Container wird mit der neuen Umgebung neu erzeugt).
- **Hauptdomain:** eigener Block `makeinnovation.de, www.makeinnovation.de` — **vorerst** `redir
  https://app.makeinnovation.de/anmelden 302`. Darunter kommentiert die Freigabe-Fassung (www → 301, Landingpage aus
  `/srv/website` read-only, strenge CSP, 404-Seite, Caching). `compose.yml` bindet dafür `./website:/srv/website:ro`
  ein — compose läuft in `/srv/make-os/app`, der Ordner kommt also mit `ausrollen.sh ziehen` auf den Server.
  `makeinnovation.de`/`www` gehören **nie** in `MAKE_OS_DOMAIN`.
- HSTS: Software wie bisher mit `includeSubDomains` (gilt nur für `*.app.makeinnovation.de`); die Hauptdomain bewusst
  **ohne** — sonst müsste jede künftige Subdomain (z. B. Mail-Autokonfiguration bei IONOS) HTTPS sprechen.

**DNS bei IONOS** (Domains & SSL → makeinnovation.de → DNS)

| Typ | Host | Wert |
|---|---|---|
| A | `app` | `2.28.108.162` |
| A | `@` | `2.28.108.162` |
| A | `www` | `2.28.108.162` (oder CNAME `www` → `makeinnovation.de`) |

- IONOS legt für `@` und `www` eigene Standard-Einträge an (Parkseite, oft auch **AAAA**). Diese **entfernen** bzw.
  ersetzen. Ein AAAA-Eintrag, der nicht auf unseren Server zeigt, lässt die Zertifikatsprüfung scheitern (Let's Encrypt
  fragt zuerst über IPv6). AAAA nur setzen, wenn der Server IPv6 hat und 80/443 dort erreichbar sind.
- MX-, SPF-/TXT- und Autodiscover-Einträge für `hello@makeinnovation.de` **nicht anfassen**.
- Optional CAA: `0 issue "letsencrypt.org"` und `0 issue "sectigo.com"` (Caddys zweiter Aussteller ZeroSSL) — oder gar
  keinen CAA-Eintrag.

**Reihenfolge**
1. DNS setzen und abwarten, bis es überall stimmt: `dig +short A app.makeinnovation.de` (ebenso `makeinnovation.de`,
   `www.makeinnovation.de`) → `2.28.108.162`; `dig +short AAAA …` → leer.
2. `.env` auf dem Server: `MAKE_OS_DOMAIN` als Liste (siehe oben, am 01.10. gesetzt) → `docker compose up -d caddy`.
3. Caddyfile + `compose.yml` mit dem neuen Block ausrollen (**nur auf Kevins Wort**). Weil sich `compose.yml`
   ändert, erzeugt `docker compose up -d` (Ausroll-Modus `bild`) den Caddy-Container neu; ändert sich später nur die
   Caddyfile: `docker compose exec caddy caddy validate --config /etc/caddy/Caddyfile` und `… caddy reload …`.
4. **Zertifikate** holt Caddy selbst (Ports 80/443 offen, Let's Encrypt, Rückfall ZeroSSL). Prüfen:
   `docker compose logs caddy | grep -i "certificate obtained"`;
   `curl -sI https://app.makeinnovation.de/anmelden` → 200 mit HSTS;
   `curl -sI https://makeinnovation.de` → 302, `location: https://app.makeinnovation.de/anmelden`.
   Stimmt DNS noch nicht, versucht Caddy es mit wachsendem Abstand erneut — die sslip-Adresse läuft davon unberührt.
5. **Erst wenn das Zertifikat für `app.makeinnovation.de` da ist:** `MAKE_OS_ADRESSE=https://app.makeinnovation.de` in
   der `.env`, dann `docker compose up -d --force-recreate app arbeiter`. Folgen — vorher einplanen:
   - **Neue Anmeldung je Gerät:** Das Sitzungs-Cookie heißt `__Host-make-os-sitzung` und gilt nur für genau den Host.
     Unter `app.makeinnovation.de` meldet sich jedes Gerät einmal neu an (mit zweitem Faktor); Home-Bildschirm-App
     dort neu hinzufügen. Unter sslip bleiben bestehende Sitzungen gültig.
   - **OAuth-Rückruf:** `REDIRECT_URI` (`lib/oauth.ts`) = `MAKE_OS_ADRESSE` + `/api/oauth/callback`. Bei Whoop
     (Developer Dashboard) und Microsoft (Azure → App-Registrierung → Authentifizierung → Umleitungs-URIs)
     `https://app.makeinnovation.de/api/oauth/callback` **vor** der Umstellung zusätzlich eintragen; die alte erst
     entfernen, wenn alles läuft. Danach Verbindungen bei Bedarf einmal neu verbinden.
   - **GitHub-Variable** `MAKE_OS_ADRESSE` (Repo → Settings → Secrets and variables → Actions → Variables) auf
     `https://app.makeinnovation.de` — sonst prüft der HOI-Außenblick (`hoi-aussenblick.yml`) weiter die sslip-Adresse.
   - Einladungslinks (`lib/innen.ts aussenAdresse`), Links ins Brain und im Scoreboard nutzen ab dann die neue Adresse;
     schon verschickte sslip-Links (auch Buchungsseiten) funktionieren weiter. Der CSRF-Schutz (`middleware.ts`)
     erkennt beide Adressen über den Host-Kopf.
   - Rückweg: `MAKE_OS_ADRESSE` wieder auf die sslip-Adresse, `docker compose up -d --force-recreate app arbeiter`.
6. **Landingpage freigeben** (später, eigener Schritt): `website/LIESMICH.md` — Platzhalter füllen →
   `node website/pruefen.mjs` grün → Kevin gibt frei → Caddyfile auf die Freigabe-Fassung → ausrollen → `caddy reload`.
