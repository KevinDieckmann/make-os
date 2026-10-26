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
#
# Update-Marke (08.10., Phase 0 — Kevin: „schmal oben auf jeder Seite, solange ein Update läuft“): nach dem Ziehen
# steht `<daten>/system/update.json` { seit, ziel } (Klartext, kein Inhalt, keine Person); nach dem Tausch — und bei
# jedem Abbruch von `bild` bzw. Altweg — ist sie wieder weg. Die App liest sie (lib/bau/update.ts, GET /api/system/update)
# und ignoriert sie nach 20 Minuten oder sobald sie selbst nach der Marke gestartet ist. Schreiben/Löschen darf das
# Ausrollen NIE aufhalten: jeder Schritt endet mit `|| true`, die Modus-Logik bleibt, wie sie war.
set -euo pipefail
cd /srv/make-os/app
MODUS="${SSH_ORIGINAL_COMMAND:-}"
echo "ausrollen-v2"

# Datenordner am Host — derselbe wie in compose.yml (`${MAKE_OS_DATEN:-/srv/make-os/daten}` → /app/.data).
DATEN="$( { grep -E '^MAKE_OS_DATEN=' .env 2>/dev/null | tail -1 | cut -d= -f2- | tr -d "\"'"; } || true)"
MARKE="${DATEN:-/srv/make-os/daten}/system/update.json"

marke_setzen() {
  {
    mkdir -p "$(dirname "$MARKE")" &&
    printf '{"seit":"%s","ziel":"%s"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$(git log -1 --format=%h 2>/dev/null || true)" > "$MARKE.tmp" &&
    chmod 644 "$MARKE.tmp" &&
    mv -f "$MARKE.tmp" "$MARKE"
  } 2>/dev/null || true
}
marke_weg() { rm -f "$MARKE" "$MARKE.tmp" 2>/dev/null || true; }

# Platz (26.10., nach der vollen Platte am 25.10.): vor dem Laden wird das laufende Bild als `make-os:vorher` gemerkt (EIN Rückweg,
# NOTFALL.md), danach räumt das Ausrollen alte `make-os:<stand>`-Bilder und den Bau-Zwischenspeicher weg. `aktuell` und `vorher`
# bleiben immer; ein Bild, das ein Container noch nutzt, lässt docker ohnehin stehen. Aufräumen darf das Ausrollen NIE aufhalten.
frei_gb() { df -Pk / 2>/dev/null | awk 'NR==2 { print int($4 / 1024 / 1024) }' || echo 0; }
vorher_merken() { docker image inspect make-os:aktuell >/dev/null 2>&1 && docker tag make-os:aktuell make-os:vorher 2>/dev/null || true; }
aufraeumen() {
  local t
  for t in $(docker images make-os --format '{{.Tag}}' 2>/dev/null || true); do
    case "$t" in aktuell|vorher|'<none>') ;; *) docker rmi "make-os:$t" >/dev/null 2>&1 || true ;; esac
  done
  docker image prune -f >/dev/null 2>&1 || true
  docker builder prune -f >/dev/null 2>&1 || true
}

ziehen() {
  echo "▸ $(date '+%F %T') ziehen"
  git fetch --quiet origin main
  git merge --ff-only origin/main
}

case "$MODUS" in
  ziehen)
    ziehen
    marke_setzen
    echo "▸ Stand: $(git log -1 --format='%h %s')"
    ;;
  bild)
    echo "▸ $(date '+%F %T') Bild empfangen"
    trap 'marke_weg' EXIT
    TMP="$(mktemp /srv/make-os/bild-XXXXXX.tar.gz)"
    # Marke weg auch, wenn Laden oder Tauschen scheitert — sonst stünde „Update läuft“ bis zu 20 Minuten umsonst da.
    trap 'rm -f "$TMP"; marke_weg' EXIT
    echo "▸ frei: $(frei_gb) GB"
    if [ "$(frei_gb)" -lt 4 ]; then echo "▸ wenig Platz — alte Bilder weg"; aufraeumen; echo "▸ frei: $(frei_gb) GB"; fi
    cat > "$TMP"
    echo "▸ $(du -h "$TMP" | cut -f1) laden"
    vorher_merken
    gunzip -c "$TMP" | docker load
    echo "▸ tauschen"
    docker compose up -d --no-build --remove-orphans
    marke_weg
    aufraeumen
    echo "▸ fertig: $(git log -1 --format='%h %s') · frei: $(frei_gb) GB"
    ;;
  *)
    ziehen
    marke_setzen
    trap 'marke_weg' EXIT
    echo "▸ bauen und tauschen (Altweg, auf dem Server)"
    vorher_merken
    docker compose up -d --build --remove-orphans
    marke_weg
    aufraeumen
    echo "▸ fertig: $(git log -1 --format='%h %s')"
    ;;
esac
