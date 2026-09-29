# MAKE OS — Notfall: Server weg → läuft wieder

Eine Seite für den Ernstfall (Server kaputt, Hetzner-Projekt gelöscht, Konto gesperrt). Stand 29.09.2026.
Hier stehen **nur Orte, nie Werte**. Ziele: **RPO 24 h** (höchstens ein Tag Daten weg), **RTO 4 h** (so lange darf
„wieder da“ dauern — gemessen wird es mit `deploy/sicherung-probe.sh --app`).

## 1 · Was ihr braucht — und wo es liegen MUSS

| Was | Wofür | Wo (jeweils alle drei) |
|---|---|---|
| **Datenschlüssel** (aktuell) | entschlüsselt jeden Bestand | Passwort-Manager Kevin · Passwort-Manager Malin · Papier im Tresor |
| **Alter Datenschlüssel** (Rotation 26.09.) und jeder weitere alte | Sicherungen von vor der jeweiligen Rotation | wie oben, Eintrag „… ALT — rotiert am …“ |
| **age-Identität** (`AGE-SECRET-KEY-…`, Datei `make-os-sicherung.txt`) | entschlüsselt die Nachtarchive | wie oben (Papier: ausgedruckt) |
| **Sicherungspasswort** (`.sicherung-passwort`, nur für alte `.enc`-Archive vor dem 26.09.) | alte Archive | wie oben |
| **GitHub-Zugang** (Repo `make-os`, `make-vault`) mit 2FA-Wiederherstellungscodes | Code + Vault | Passwort-Manager beider |
| **Hetzner-Zugang** mit 2FA | neuer Server | Passwort-Manager beider |
| Die Archive selbst | Daten | Mac `~/MAKE-OS-Sicherungen` (täglich abgeholt) · Server `/srv/make-os/sicherungen` · Hetzner-Abbilder |

Jährlich prüfen (Übung, Abschnitt 3), ob alle drei Orte den **aktuellen** Stand haben — nach jeder Rotation sofort.

## 2 · Schritte „Server weg“ → „läuft wieder“

1. **Archiv wählen:** das neueste `make-os-JJJJ-MM-TT.tar.gz.age` aus `~/MAKE-OS-Sicherungen` (der Mac holt jeden Morgen ab).
   Ist die Abholung älter als 48 h, zeigte der Head of IT das rot — dann das neueste vorhandene nehmen.
2. **Am Mac prüfen** (Homebrew: `brew install age`; Node liegt unter `~/.local/node22/bin`):
   `read -rs MAKE_OS_DATEN_SCHLUESSEL && export MAKE_OS_DATEN_SCHLUESSEL` →
   `deploy/sicherung-probe.sh ~/MAKE-OS-Sicherungen/<archiv> <age-identität>` → muss „Probe bestanden“ sagen.
   Archiv von vor einer Rotation: zusätzlich `MAKE_OS_DATEN_SCHLUESSEL_ALT` exportieren.
3. **Neuer Server** (Hetzner, Ubuntu 24.04): `bash server-einrichten.sh <repo>` und `server-haerten.sh` wie in DEPLOY.md.
4. **Schlüssel ablegen:** `sudo install -d -m 700 -o make -g make /srv/make-os/schluessel` und den Datenschlüssel in
   `/srv/make-os/schluessel/daten` (0400, Besitzer make) — per Terminal-Eingabe, nie über einen Chat oder Claude.
   In die `.env` NICHT als `MAKE_OS_DATEN_SCHLUESSEL` (die Umgebung ginge vor und wäre in `docker inspect` sichtbar).
5. **Daten zurück:** Archiv per `scp` auf den Server, dort `age -d -i <identität> <archiv> | tar xzf - -C /srv/make-os`
   (legt `daten/` an; die Identität danach vom Server löschen). `chown -R make:make /srv/make-os/daten`.
6. **Grabsteine (Art. 17, 29.09.):** vor dem Start `/srv/make-os/grabsteine` aus dem Archiv übernehmen, falls der Ordner
   fehlt (das Archiv trägt ihn). Einfacher und zwingend mit Grabsteinen: `deploy/wiederherstellen.sh <archiv> <identität>`
   (hält den Arbeiter aus, bis die Grabsteine angewendet sind). Bei einem Restore von Hand nach dem Start:
   `docker compose exec -T app node -e "fetch('http://localhost:3000/api/crm/datenschutz',{method:'POST',headers:{'content-type':'application/json','x-make-key':process.env.MAKE_OS_KEY},body:'{\"aktion\":\"grabsteine\"}'}).then(r=>r.text()).then(console.log)"`
   — sonst sind nach dem Archiv gelöschte Personen wieder da (der Takt holt es spätestens nach einer Minute nach).
7. **Starten:** `cd /srv/make-os/app && docker compose up -d`; HOI öffnen (`/os/hoi`): „Bestände im Ruhezustand:
   verschlüsselt“, keine roten Befunde; die Durchsicht aller Bestände läuft täglich ab 4 Uhr von selbst. Dann
   `sicherung.pub`, Healthcheck-Adresse, Cron, Logrotate und den Mac-Abholschlüssel wieder einrichten
   (DEPLOY.md › Sicherung, Offsite, Wiederherstellung).
8. **Was fehlt:** alles seit dem Archiv (≤ 24 h). Der Vault kommt aus GitHub (`make-vault`), nicht aus dem Archiv.

### Absichten (abgebrochene Vorgänge, Paket D-C)

Zeigt der Head of IT „Abgebrochene Vorgänge“ **rot** (nach 3 Versuchen nicht fertig): ein Vorgang über mehrere Bestände
(Art. 17, Import, Dubletten, Kennungs-Umzug, Angebot, CRM-Folgen) hängt halb. Nichts von Hand in `.data` ändern.
1. Grund lesen: `docker compose logs app | grep -i absicht` bzw. `GET /api/intern/absichten` (nur Art, Schritte, Fehlergrund —
   nie Personendaten).
2. Ursache beheben (meist ein beschädigter Bestand → `.corrupt-…` prüfen, Einzel-Restore; volle Platte; fehlender Schlüssel).
3. Wieder anstoßen: `POST /api/intern/absichten { "aktion": "erneut", "id": "ab-…" }` (Inhaber bzw. Dienstweg) — die Schritte
   sind idempotent, bereits erledigte laufen nicht noch einmal. Ein Art.-17-Vorgang steht bis dahin im Löschprotokoll auf
   „unvollständig“.

## 3 · Jährliche Übung (und nach jeder Rotation)

Ohne Server-Zugriff, nur mit Mac + Passwort-Manager: Schritt 2 mit `--app` (`deploy/sicherung-probe.sh <archiv>
<identität> --app`) — startet MAKE OS im Probe-Ordner und misst die Zeit bis „App antwortet“. Ergebnis in
DEPLOY.md › Probe-Restore eintragen (Datum, Archiv, Bestände, Dauer). Dauert es länger als das RTO, Ablauf hier
nachschärfen. Dazu einmal prüfen: liegen Schlüssel, alter Schlüssel und age-Identität an allen drei Orten?

## 4 · Bedrohungen in einem Satz (ausführlich: DATENARCHITEKTUR.md › Bedrohungsmodell)

Ein **Hetzner-Abbild enthält Daten UND Schlüssel** (Datei bzw. `.env`) — es ist so schutzwürdig wie der Server
selbst. Die Nachtarchive sind mit age verschlüsselt: ohne die Identität (nur bei euch) wertlos — auch für den Server.
