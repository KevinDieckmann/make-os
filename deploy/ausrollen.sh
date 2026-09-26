#!/usr/bin/env bash
# ─── MAKE OS · Ausrollen (Forced Command des Ausroll-Schlüssels, 26.09.) ────
# Das ist der EINZIGE Befehl, den der Ausroll-Schlüssel der GitHub-Action auf
# dem Server auslösen darf. Er steht im Repo, damit er prüfbar ist:
#   nur vorspulen (kein Rebase, kein fremder Branch), dann neu bauen und tauschen.
# authorized_keys von make (eine Zeile):
#   command="/srv/make-os/app/deploy/ausrollen.sh",restrict ssh-ed25519 AAAA… make-os-ausrollen
set -euo pipefail
cd /srv/make-os/app
echo "▸ $(date '+%F %T') ziehen"
git fetch --quiet origin main
git merge --ff-only origin/main
echo "▸ bauen und tauschen"
docker compose up -d --build --remove-orphans
docker image prune -f >/dev/null
echo "▸ fertig: $(git log -1 --format='%h %s')"
