# Go-Live-Checkliste — Stand `entwicklung` 8b20804 (29.09.2026)

**Urteil: Ja, mit Bedingungen.** Im Code blockiert nichts (tsc, Lint, 2.579 Tests, Produktionsbau grün; Trockenlauf auf einer verschlüsselten Kopie der lokalen Daten: alles lesbar, alle Zahlen gleich, Neustart und harter Absturz ok).
**Wichtig: Der Upload ist eine Einbahnstraße.** Die neue Version schreibt Bestände in der neuen Verschlüsselung (v2). Der alte Stand (aeb4964) kann v2 nicht lesen. Zurück geht es nur mit der Daten-Sicherung von vor dem Upload (Schritt V7) oder mit dem getesteten Rückweg-Skript (unten).

Alle Befehle auf dem Server als `make`, im Ordner `/srv/make-os/app`, außer wo „am Mac“ steht. Werte (Schlüssel, Passwörter) nie in Chat oder Dateien im Repo.

## Vor dem Upload
1. `git status --short` → muss leer sein (sonst bricht das Ausrollen ab).
2. `id -u make` → muss `1000` sein.
3. **Grabstein-Ordner:** `sudo install -d -m 700 -o make -g make /srv/make-os/grabsteine` (sonst legt Docker ihn als root an und Löschungen nach Art. 17 scheitern).
4. **age (empfohlen, kein Blocker mehr):** am Mac `brew install age && age-keygen -o ~/make-os-sicherung.txt` → Datei in beide Passwort-Manager + Papier; die Zeile `age1…` auf dem Server nach `/srv/make-os/sicherung.pub`; `sudo apt-get install -y age`. Ohne age sichert die Nacht über den bisherigen Weg weiter (HOI rot als Erinnerung).
5. **Klartext prüfen (nur Dateinamen):** `cd /srv/make-os/daten && for f in *.json; do head -c 24 "$f" | grep -q __verschluesselt || echo "KLARTEXT: $f"; done` → bei Treffern `MAKE_OS_KLARTEXT_MIGRATION=1` in die `.env` und nach dem Upload Schritt N6.
6. **Pepper (empfohlen):** `openssl rand -hex 32` als `MAKE_OS_PEPPER=` in die `.env` und in beide Passwort-Manager. **Nie wieder ändern.**
7. **Sicherung + altes Bild merken (Pflicht):**
   `docker compose stop app arbeiter && sudo tar -C /srv/make-os -czf /srv/make-os/sicherungen/vor-upload-$(date +%F-%H%M).tar.gz daten grabsteine && docker tag make-os:aktuell make-os:aeb4964 && docker compose start app arbeiter` — danach eine Kopie per `scp` auf den Mac holen.
8. Kevin und Malin: alle MAKE-OS-Tabs auf allen Geräten schließen, während des Uploads nichts eingeben.

## Upload (nur auf Kevins Wort)
Am Mac: `cd ~/Claude/Projects/MakeOS && git push origin entwicklung:main && git push origin entwicklung` → GitHub-Action (~10–12 Min): „pruefen“ grün, im Ausrollen-Log „fertig: 8b20804 …“.

## Direkt nach dem Upload
1. `docker compose ps` → app healthy, arbeiter läuft.
2. `docker compose logs app --since 10m | grep -iE "klartext|entschlüsselung|nicht lesbar|absicht|lockfile"` → nichts Rotes.
3. Auf allen Geräten neu laden (Handy: Tab/App schließen und neu öffnen).
4. Kurztest: anmelden · Aufgabe anlegen, abhaken, „Rückgängig“ · CRM Kontakt öffnen, ein Feld ändern · Angebot nur Entwurf + Vorschau (Stellen verbraucht eine Nummer) · Glocke · eine ZOE-Frage · Finanzplan öffnen · `/os/hoi` (kein „Klartext-Bestand abgelehnt“, „Abgebrochene Vorgänge: keine“).
5. Sicherung einmal von Hand: `bash /srv/make-os/app/deploy/sicherung.sh` → muss „ok“ bzw. „warnung (Übergangs-Verschlüsselung)“ melden.
6. Nur bei Treffern aus V5: `docker compose stop app arbeiter && docker compose run --rm -T --no-deps app node scripts/daten-verschluesselung.mjs --verschluesseln </dev/null && docker compose up -d`, danach `MAKE_OS_KLARTEXT_MIGRATION` aus der `.env` und `docker compose up -d`.
7. **Erst jetzt entscheiden, ob es bleibt.** Rückweg bei Fehler: `docker compose stop app arbeiter` → `daten` beiseitelegen → Sicherung aus V7 entpacken → `docker tag make-os:aeb4964 make-os:aktuell && docker compose up -d --no-build` → `main` per Revert auf aeb4964 bringen (sonst rollt die nächste Action wieder aus). Alles seit dem Upload ist dann verloren. Alternative ohne Datenverlust (im Trockenlauf getestet): App anhalten, mit dem neuen Bild `node scripts/daten-verschluesselung.mjs --entschluesseln`, altes Bild starten, dann dessen Skript `--verschluesseln`.

## Am ersten Tag
1. Erst nach grünem Kurztest: Aufgaben › Überblick › **„Neu anfangen …“** (Vorschau prüfen, „NEU ANFANGEN“ tippen). Alles wird archiviert, nicht gelöscht; zurück unter Aufgaben › Archiv › „Neu angefangen“. Ab hier bedeutet ein Rückweg per Sicherung, die neue Planung zu verlieren.
2. **Nicht** am selben Tag: Kennungs-Umzug der Kontakte, Schlüssel als Datei, `MAKE_OS_APP_SPIEGEL=an`.
3. Innerhalb der Woche: Healthchecks-Adresse nach `/srv/make-os/.healthchecks-sicherung`, Logrotate (`deploy/logrotate-make-os`), Mac-Abholung der Sicherung (`authorized_keys` ändert Kevin selbst), Vault-Umzug nach `VAULT_UMZUG_ANLEITUNG.md`, AVV mit dem KI-Anbieter ablegen.
4. Nächster Morgen: HOI „Sicherung geprüft“, Tagesstart gelaufen, Durchsicht ab 4 Uhr erledigt. Gelbe Hinweise (Pepper, Schlüssel in der Umgebung, Healthcheck, Abholung) sind erwartet, bis die Punkte oben erledigt sind.

## Hinweis zum Healthcheck
Solange age fehlt, meldet die Nachtsicherung bewusst `/fail` an Healthchecks (Erinnerung). Wer das nicht will: age zuerst einrichten.
