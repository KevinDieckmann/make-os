#!/usr/bin/env bash
# ─── MAKE OS · Daten vom Mac auf den Server (einmalig beim Umzug) ──────────
# Aufruf auf dem Mac:  bash deploy/daten-hochladen.sh <server-ip-oder-name>
# Überträgt .data OHNE lokale Sicherungen, Archiv und Prüfdaten (echte
# Bankdaten für Tests bleiben auf dem Mac). Danach gilt: gearbeitet wird
# NUR noch online — der Mac liefert nur noch Apple-Daten zu.
set -euo pipefail
ZIEL="${1:-}"
[ -n "$ZIEL" ] || { echo "Aufruf: bash deploy/daten-hochladen.sh <server>"; exit 1; }
cd "$(dirname "$0")/.."
echo "▸ Probelauf — was würde übertragen?"
rsync -azn --stats --exclude backup/ --exclude archiv/ --exclude pruefdaten/ --exclude '*.log' --exclude '*.pid' --exclude '*.corrupt-*' .data/ "make@$ZIEL:/srv/make-os/daten/" | grep -E "Number of (regular )?files|Total transferred"
read -r -p "Jetzt wirklich hochladen? (ja/nein) " a
[ "$a" = "ja" ] || { echo "Abgebrochen."; exit 0; }
rsync -az --exclude backup/ --exclude archiv/ --exclude pruefdaten/ --exclude '*.log' --exclude '*.pid' --exclude '*.corrupt-*' .data/ "make@$ZIEL:/srv/make-os/daten/"
echo "▸ Hochgeladen. Ab jetzt nur noch online arbeiten — sonst laufen zwei Stände auseinander."
