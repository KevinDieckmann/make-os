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
