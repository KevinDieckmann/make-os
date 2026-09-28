#!/usr/bin/env bash
# ─── MAKE OS · Datenschlüssel rotieren (als make auf dem Server, 26.09.) ─────
# Wann: der Schlüssel ist irgendwo aufgetaucht, wo er nicht hingehört (Chat,
# Ticket, Bildschirmfoto). Ablauf: App und Arbeiter anhalten → mit dem alten
# Schlüssel entschlüsseln → neuen Schlüssel in .env → verschlüsseln → starten.
# Etwa eine Minute Unterbrechung. Der neue Schlüssel wird NICHT ausgegeben —
# danach in der eigenen Terminal-App auslesen und in den Passwort-Manager:
#   grep MAKE_OS_DATEN_SCHLUESSEL /srv/make-os/app/.env
# Wichtig: `docker compose run` bekommt </dev/null — sonst frisst der Container
# die Eingabe des aufrufenden Skripts (so ist am 26.09. ein Lauf mittendrin
# abgebrochen, mit entschlüsselten Beständen auf der Platte).
set -euo pipefail
cd /srv/make-os/app
ALT=$(grep '^MAKE_OS_DATEN_SCHLUESSEL=' .env | cut -d= -f2-)
[ -n "$ALT" ] || { echo "Kein Datenschlüssel in .env — nichts zu rotieren."; exit 1; }
NEU=$(openssl rand -hex 32)
echo "▸ Vorab: Steht der jetzige (alte) Datenschlüssel im Passwort-Manager? Er wird für die Sicherungen der letzten 14 Tage gebraucht (Hinweis am Ende)."
echo "▸ App und Arbeiter anhalten"
docker compose stop app arbeiter </dev/null
echo "▸ mit dem alten Schlüssel entschlüsseln"
docker compose run --rm -T --no-deps -e MAKE_OS_DATEN_SCHLUESSEL="$ALT" app node scripts/daten-verschluesselung.mjs --entschluesseln </dev/null
echo "▸ neuen Schlüssel setzen"
sed -i "s|^MAKE_OS_DATEN_SCHLUESSEL=.*|MAKE_OS_DATEN_SCHLUESSEL=$NEU|" .env
chmod 600 .env
echo "▸ mit dem neuen Schlüssel verschlüsseln"
docker compose run --rm -T --no-deps -e MAKE_OS_DATEN_SCHLUESSEL="$NEU" app node scripts/daten-verschluesselung.mjs --verschluesseln </dev/null
echo "▸ starten"
docker compose up -d </dev/null
for i in $(seq 1 24); do docker ps --format '{{.Names}} {{.Status}}' | grep -q 'app-app-1.*(healthy)' && break; sleep 5; done
docker ps --format '{{.Names}} {{.Status}}'
REST=$(grep -L __verschluesselt /srv/make-os/daten/*.json /srv/make-os/daten/backup/*.json 2>/dev/null | wc -l)
echo "▸ fertig — Klartext-Reste: $REST. Neuen Schlüssel jetzt in den Passwort-Manager (siehe Kopf dieser Datei)."
# Alter Schlüssel (28.09., K1 #109/#110): Tagesarchive (14 Tage) und Hetzner-Abbilder (7 Tage) von VOR der
# Rotation enthalten Bestände, die mit dem ALTEN Schlüssel verschlüsselt sind — ohne ihn sind sie wertlos.
# Das Skript gibt keinen Schlüssel aus, weder alt noch neu.
cat <<HINWEIS

════════════════════════════════════════════════════════════════════════════
  WICHTIG — DEN ALTEN SCHLÜSSEL AUFBEWAHREN, NICHT ÜBERSCHREIBEN

  Die Sicherungen von vor heute ($(date +%F)) sind mit dem ALTEN Datenschlüssel
  verschlüsselt:
    · Tagesarchive in /srv/make-os/sicherungen  — 14 Tage
    · Hetzner-Abbilder (Backups)                — 7 Tage
  Im Passwort-Manager den bisherigen Eintrag deshalb NICHT mit dem neuen
  Schlüssel überschreiben, sondern umbenennen in
    „MAKE OS Datenschlüssel ALT — rotiert am $(date +%F), aufbewahren bis $(date -d '+15 days' +%F 2>/dev/null || date -v+15d +%F)“
  und den neuen als eigenen Eintrag anlegen. Erst nach diesem Datum löschen.
  Danach einmal zurückholen üben: deploy/sicherung-probe.sh (am Mac).
════════════════════════════════════════════════════════════════════════════
HINWEIS
