#!/usr/bin/env bash
# ─── MAKE OS · Ausrollen (Forced Command des Ausroll-Schlüssels, 26.09.) ────
# Das ist der EINZIGE Befehl, den der Ausroll-Schlüssel der GitHub-Action auf
# dem Server auslösen darf. Er steht im Repo, damit er prüfbar ist.
# authorized_keys von make (eine Zeile):
#   command="/srv/make-os/app/deploy/ausrollen.sh",restrict ssh-ed25519 AAAA… make-os-ausrollen
#
# Seit 26.09. abends (Tempo): Gebaut wird NICHT mehr auf dem Server — der
# 1-CPU-Server war während jedes Baus 8–12 Minuten kaum benutzbar. Die Action
# baut das Bild auf GitHub und schickt es fertig her. Drei Modi (über
# SSH_ORIGINAL_COMMAND, die Action wählt):
#   ziehen  — nur den Stand vorspulen (compose.yml, Skripte), nichts bauen
#   bild    — das Bild aus stdin laden (docker save | gzip) und tauschen
#   (leer)  — Altweg: ziehen und auf dem Server bauen (Rückfall)
set -euo pipefail
cd /srv/make-os/app
MODUS="${SSH_ORIGINAL_COMMAND:-}"
echo "ausrollen-v2"

ziehen() {
  echo "▸ $(date '+%F %T') ziehen"
  git fetch --quiet origin main
  git merge --ff-only origin/main
}

case "$MODUS" in
  ziehen)
    ziehen
    echo "▸ Stand: $(git log -1 --format='%h %s')"
    ;;
  bild)
    echo "▸ $(date '+%F %T') Bild empfangen"
    TMP="$(mktemp /srv/make-os/bild-XXXXXX.tar.gz)"
    trap 'rm -f "$TMP"' EXIT
    cat > "$TMP"
    echo "▸ $(du -h "$TMP" | cut -f1) laden"
    gunzip -c "$TMP" | docker load
    echo "▸ tauschen"
    docker compose up -d --no-build --remove-orphans
    docker image prune -f >/dev/null
    echo "▸ fertig: $(git log -1 --format='%h %s')"
    ;;
  *)
    ziehen
    echo "▸ bauen und tauschen (Altweg, auf dem Server)"
    docker compose up -d --build --remove-orphans
    docker image prune -f >/dev/null
    echo "▸ fertig: $(git log -1 --format='%h %s')"
    ;;
esac
