# Go-Live-Checkliste — Stand `entwicklung` ab 79bee77 (29.09.2026, zweite Prüfung)

**Urteil: Ja, mit Bedingungen.** Im Code blockiert nichts: tsc, Lint, alle Tests und der Produktionsbau sind grün. Ein Trockenlauf auf einer verschlüsselten Kopie der lokalen Daten zeigte alles lesbar und alle Zahlen gleich; Neustart und harter Absturz liefen sauber. Durchgeklickt wurde im Produktionsbau mit zwei Konten, gefundene Fehler sind behoben.

**Rückweg ist möglich (Kompatibilitätsmodus).** Ohne Variable schreibt die neue Version im Format des alten Online-Stands (aeb4964): v1-Hülle, `MKOSDAT1`, kein `_v`, Sperrliste mit dem alten Wert. Das alte Programm kann die Daten also weiter lesen. Beim Zurückgehen fallen nur Dinge weg, die der alte Stand nicht kennt (neue Aufgaben-Felder wie Verlauf, Kommentare, Listen, Serien, „abgebrochen“; einzelne neue CRM-Felder). **Erst wenn ihr später `MAKE_OS_FORMAT=v2` setzt, wird der Upload zur Einbahnstraße** — dann geht es nur noch über die Sicherung zurück. Dafür nach einigen stabilen Tagen `DEPLOY.md` › „Schreibformat“ folgen.

Alle Befehle auf dem Server als `make`, im Ordner `/srv/make-os/app`, außer wo „am Mac“ steht. Werte (Schlüssel, Passwörter) nie in Chat oder Repo.

## Vor dem Upload
1. `git status --short` → leer, und `git status -sb` → erste Zeile ohne „ahead“ (sonst bricht das Ausrollen ab).
2. `id -u make` → `1000`.
3. Ordner anlegen (sonst legt Docker sie als root an; ohne beschreibbaren Grabstein-Ordner scheitern Löschungen nach Art. 17):
   `sudo install -d -m 700 -o make -g make /srv/make-os/grabsteine /srv/make-os/schluessel`
4. **Datenschlüssel bleibt in der `.env`** (`MAKE_OS_DATEN_SCHLUESSEL=`) — der alte Stand kennt keine Schlüssel-Datei; nur so bleibt der Rückweg offen.
5. **age (empfohlen):** am Mac `brew install age && age-keygen -o ~/make-os-sicherung.txt` → Datei in beide Passwort-Manager und auf Papier; die Zeile `age1…` auf dem Server nach `/srv/make-os/sicherung.pub`; `sudo apt-get install -y age`. Ohne age sichert die Nacht weiter über den bisherigen Weg, HOI zeigt dann rot als Erinnerung.
6. **Klartext prüfen (nur Dateinamen, in einer Unter-Shell):**
   `( cd /srv/make-os/daten && for f in *.json archiv/*.json backup/*.json; do [ -f "$f" ] || continue; head -c 24 "$f" | grep -q __verschluesselt || echo "KLARTEXT: $f"; done )`
   Bei Treffern: `MAKE_OS_KLARTEXT_MIGRATION=1` in die `.env`, nach dem Upload Schritt N6.
7. **Pepper (empfohlen):** `openssl rand -hex 32` als `MAKE_OS_PEPPER=` in die `.env` und in beide Passwort-Manager. **Nie wieder ändern.**
8. **Kevin und Malin schließen alle MAKE-OS-Tabs auf allen Geräten** und geben bis nach N4 nichts ein.
9. **Sicherung und altes Bild merken (Pflicht)** — Zeile für Zeile, jede Ausgabe prüfen:
   ```
   docker compose stop app arbeiter
   sudo tar -C /srv/make-os --exclude='daten/brain-index.sqlite*' -czf /srv/make-os/sicherungen/vor-upload-$(date +%F-%H%M).tar.gz daten grabsteine; echo "tar-Ergebnis: $?"
   docker tag make-os:aktuell make-os:aeb4964
   docker compose start app arbeiter
   docker image ls make-os
   docker run --rm --entrypoint sh make-os:aeb4964 -c 'test ! -e lib/store/huelle.mjs && test -e scripts/daten-verschluesselung.mjs && echo ALTES-BILD-OK'
   sudo chown make:make /srv/make-os/sicherungen/vor-upload-*.tar.gz && chmod 600 /srv/make-os/sicherungen/vor-upload-*.tar.gz
   ```
   Nur bei `tar-Ergebnis: 0`, gleicher Image-ID für `aeb4964` und `aktuell` und `ALTES-BILD-OK` weitermachen. Kopie auf den Mac nur verschlüsselt: `age -R /srv/make-os/sicherung.pub -o <datei>.age <datei>`, dann die `.age`-Datei per `scp` holen.
10. Auf GitHub: Repo-Variable `AUSROLLEN` ist nicht `aus`; im letzten Ausroll-Log stehen `ausrollen-v2` und „Bild zum Server schicken“.

## Upload (nur auf Kevins Wort)
Am Mac: `cd ~/Claude/Projects/MakeOS && git push origin entwicklung:main && git push origin entwicklung` → GitHub-Action (~10–12 Min.): „pruefen“ grün, im Ausroll-Log „fertig: <neuester Commit> …“.

## Direkt nach dem Upload
1. `docker compose ps` → app healthy (bis ~30 s „starting“ ist normal), arbeiter läuft.
2. `docker compose logs --since 10m app | grep -iE "local-db|MAKE OS\]|klartext|schluessel fehlt|entschlüsselung|nicht lesbar|beschädigt|gescheitert|lockfile|⨯"` → erlaubt sind nur „[MAKE OS] Absichten beim Start: … 0 gescheitert.“ und „[local-db] jarvis-… → zoe-…“. Jede andere Zeile: anhalten, nichts eingeben, Rückweg prüfen.
3. Auf allen Geräten neu laden (Handy: Tab bzw. Home-Screen-App schließen und neu öffnen).
4. Kurztest: anmelden · Aufgabe anlegen, abhaken, „Rückgängig“ · CRM Kontakt öffnen, ein Feld ändern · Mandat öffnen, Titel ändern · Angebot nur Entwurf und Vorschau (Stellen verbraucht eine Nummer) · Glocke · eine ZOE-Frage · Finanzplan öffnen · `/os/hoi`: kein „Klartext-Bestand abgelehnt“, „Abgebrochene Vorgänge: keine“, gelb „Kompatibilitätsmodus“ ist erwartet.
5. Sicherung einmal von Hand, vorher die heutige Nachtsicherung schützen:
   `for f in /srv/make-os/sicherungen/make-os-$(date +%F).tar.gz.*; do [ -e "$f" ] && mv "$f" "$(dirname "$f")/vor-upload-nacht-$(basename "$f")"; done`
   dann `bash /srv/make-os/app/deploy/sicherung.sh` (als make, ohne sudo) → letzte Zeile endet auf `: ok (Ping: …)` bzw. ohne age auf `: warnung — age fehlt — Sicherung nur mit Übergangs-Verschlüsselung …`.
6. Nur bei Klartext-Treffern aus V6:
   ```
   docker compose stop app arbeiter
   docker compose run --rm -T --no-deps app node scripts/daten-verschluesselung.mjs --verschluesseln </dev/null   # muss auf „… 0 Fehler.“ enden
   ```
   Dann `MAKE_OS_KLARTEXT_MIGRATION=1` aus der `.env` löschen und `docker compose up -d`.
7. **Rückweg, falls nötig (solange `MAKE_OS_FORMAT` nicht `v2` ist):**
   ```
   docker compose stop app arbeiter
   docker tag make-os:aeb4964 make-os:aktuell
   docker compose up -d --no-build
   ```
   Danach am Mac `main` zurückdrehen, sonst rollt die nächste Action wieder aus:
   ```
   git switch -c rueckweg origin/main && git revert --no-edit --no-commit aeb4964..HEAD && git commit -m "Rückweg: Stand aeb4964"
   git diff --stat aeb4964 HEAD      # muss leer sein
   git push origin rueckweg:main
   ```
   Dieser Push rollt den alten Code erneut aus (gewollt). Wer das nicht will: vorher die Repo-Variable `AUSROLLEN=aus` setzen. Neue Aufgaben-Felder gehen dabei verloren; Löschungen nach Art. 17 seit dem Upload bleiben erhalten (die Daten selbst sind gelöscht), Grabsteine wirken im alten Stand aber nicht. Nur im Notfall auf die Sicherung aus V9 zurück (dann ist alles seit dem Upload weg).

## Am ersten Tag
1. Erst nach grünem Kurztest: Aufgaben › Überblick › **„Neu anfangen …“** (Vorschau prüfen, „NEU ANFANGEN“ tippen). Alles wird archiviert, nicht gelöscht; zurück unter Aufgaben › Archiv › „Neu angefangen“. Hinweis: Ein Rückweg zum alten Stand würde die neue Planung (Listen, Gruppen, Serien) nicht kennen.
2. **Nicht** in den ersten Tagen: `MAKE_OS_FORMAT=v2`, Kennungs-Umzug der Kontakte, Schlüssel als Datei, `MAKE_OS_APP_SPIEGEL=an` — alles erst, wenn ihr sicher bleiben wollt.
3. Innerhalb der Woche: Healthchecks-Adresse nach `/srv/make-os/.healthchecks-sicherung`; Logrotate `sudo install -m 644 /srv/make-os/app/deploy/logrotate-make-os /etc/logrotate.d/make-os`; Mac-Abholung der Sicherung (`authorized_keys` ändert Kevin selbst); Vault-Umzug nach `VAULT_UMZUG_ANLEITUNG.md`; AVV mit dem KI-Anbieter ablegen.
4. Nächster Morgen: Tagesstart gelaufen, Durchsicht ab 4 Uhr erledigt. „Sicherung geprüft“ ist nur mit age grün; ohne age rot („age fehlt — Sicherung nur mit Übergangs-Verschlüsselung“) — dann erwartet. Gelb erwartet: Kompatibilitätsmodus, Pepper, Schlüssel in der Umgebung, Healthcheck, Abholung.

## Hinweis zum Healthcheck
Solange age fehlt, meldet die Nachtsicherung bewusst `/fail` an Healthchecks (Erinnerung). Wer das nicht will: age zuerst einrichten.
