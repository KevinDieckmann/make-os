# MAKE OS gemeinsam betreiben

## ▶ Live gehen — die Schritte (vorbereitet 24.09. abends)

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
Mikrofon frei (Jarvis per Sprache) und legt keine App auf den Home-Bildschirm.

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
- **Sicherung:** liegt `/srv/make-os/sicherung.pub` (öffentlicher age-Schlüssel), verschlüsselt der Server damit —
  entschlüsseln kann nur Kevin. Erzeugen auf dem Mac: `age-keygen -o ~/make-os-sicherung.txt` (Datei in den
  Passwort-Manager), die Zeile `age1…` nach `/srv/make-os/sicherung.pub`. Bis dahin gilt weiter das
  openssl-Passwort. Zweiter Ablageort (Storage Box / anderer Anbieter) ist noch offen.
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

Nicht verschlüsselt: Bilder unter `daten/bauplan-bilder`, das Archiv `daten/archiv` (Umzugs-Stände) und das
Obsidian-Hirn (eigenes Git-Repo). Das sind bewusste Ausnahmen; die JSON-Bestände sind das, worum es geht.

