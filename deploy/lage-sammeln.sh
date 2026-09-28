#!/usr/bin/env bash
# ─── MAKE OS · Lage-Sammler für den Head of IT (Cron auf dem Server, alle 5 Minuten) ──
# Schreibt nach /srv/make-os/daten/system/lage.json, was die App im Container selbst
# nicht sehen kann: Platte, Arbeitsspeicher, Last, Container-Zustand und Neustarts,
# fail2ban-Zähler, SSH-Fehlversuche, Zertifikatsrest, Alter der letzten Sicherung,
# Vault-Stand, wartende Sicherheitsupdates. NUR Zähler und Zustände — keine Adressen,
# keine Namen, keine Inhalte (die App liest die Datei über /api/hoi/lage).
#
# Einrichten (einmalig, als make mit sudo):
#   sudo install -m 755 /srv/make-os/app/deploy/lage-sammeln.sh /usr/local/bin/make-os-lage
#   ( sudo crontab -l 2>/dev/null; echo '*/5 * * * * /usr/local/bin/make-os-lage >/dev/null 2>&1' ) | sudo crontab -
set -uo pipefail
BASIS=${MAKE_OS_BASIS:-/srv/make-os}
ZIEL_DIR="$BASIS/daten/system"
ZIEL="$ZIEL_DIR/lage.json"
DOMAIN=$(grep -E '^MAKE_OS_DOMAIN=' "$BASIS/app/.env" 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'")
mkdir -p "$ZIEL_DIR"

zahl() { [ -n "${1:-}" ] && printf '%s' "$1" || printf 'null'; }

# Platte (Wurzel)
read -r P_BELEGT P_FREI <<<"$(df -BG --output=pcent,avail / 2>/dev/null | tail -1 | tr -d 'G%' | awk '{print $1, $2}')"
# Speicher (MB)
read -r M_GESAMT M_FREI SW_BELEGT <<<"$(free -m 2>/dev/null | awk '/^Mem:/{g=$2; f=$7} /^Swap:/{s=$3} END{print g, f, s}')"
# Last
read -r L1 L5 L15 <<<"$(cut -d' ' -f1-3 /proc/loadavg 2>/dev/null)"
KERNE=$(nproc 2>/dev/null || echo 1)

# Container: Name, Status, Health, Neustarts (docker ps + inspect), ohne Inhalte
CONTAINER="[]"
if command -v docker >/dev/null 2>&1; then
  CONTAINER=$(docker ps -a --format '{{.Names}}\t{{.Status}}' 2>/dev/null | while IFS=$'\t' read -r name status; do
    [ -z "$name" ] && continue
    gesund=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$name" 2>/dev/null)
    neu=$(docker inspect --format '{{.RestartCount}}' "$name" 2>/dev/null)
    printf '{"name":"%s","status":"%s","gesund":"%s","neustarts":%s},' "$name" "$(printf '%s' "$status" | sed 's/"/\\"/g')" "$gesund" "$(zahl "$neu")"
  done | sed 's/,$//' | awk '{print "[" $0 "]"}')
  [ -z "$CONTAINER" ] && CONTAINER="[]"
fi

# fail2ban (nur Zähler)
F2B_GESPERRT=""; F2B_VERSUCHE=""
if command -v fail2ban-client >/dev/null 2>&1; then
  F2B_GESPERRT=$(fail2ban-client status sshd 2>/dev/null | awk -F: '/Currently banned/{gsub(/ /,"",$2); print $2}')
  F2B_VERSUCHE=$(fail2ban-client status sshd 2>/dev/null | awk -F: '/Total failed/{gsub(/ /,"",$2); print $2}')
fi
# SSH-Fehlversuche 24 h (journal, nur die Zahl)
SSH_FEHL=$(journalctl -u ssh --since -24h --no-pager 2>/dev/null | grep -c 'Failed password\|Invalid user' || echo 0)

# Zertifikat: Resttage über den eigenen Caddy
Z_TAGE=""; Z_BIS=""
if [ -n "$DOMAIN" ] && command -v openssl >/dev/null 2>&1; then
  ENDE=$(echo | timeout 10 openssl s_client -servername "$DOMAIN" -connect 127.0.0.1:443 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
  if [ -n "$ENDE" ]; then Z_BIS=$(date -d "$ENDE" +%F 2>/dev/null); Z_TAGE=$(( ( $(date -d "$ENDE" +%s) - $(date +%s) ) / 86400 )); fi
fi

# Sicherung: jüngste Datei, Alter in Stunden, Größe in MB
S_ALTER=""; S_GROESSE=""; S_DATEI=""
J=$(ls -t "$BASIS"/sicherungen/make-os-*.tar.gz.* 2>/dev/null | head -1)
if [ -n "$J" ]; then S_DATEI=$(basename "$J"); S_ALTER=$(awk -v m="$(stat -c %Y "$J")" -v n="$(date +%s)" 'BEGIN{printf "%.1f", (n-m)/3600}'); S_GROESSE=$(du -m "$J" | cut -f1); fi

# Abholung durch den Mac (29.09., Paket D-A): Marke von deploy/sicherung-ausgeben.sh (bestaetigen) — Alter in Stunden
A_ALTER=""; A_DATEI=""
if [ -f "$BASIS/daten/system/abholung.json" ]; then
  A_ZEIT=$(grep -o '"zeit":"[^"]*"' "$BASIS/daten/system/abholung.json" | cut -d'"' -f4)
  A_DATEI=$(grep -o '"datei":"[^"]*"' "$BASIS/daten/system/abholung.json" | cut -d'"' -f4)
  [ -n "$A_ZEIT" ] && A_ALTER=$(awk -v m="$(date -d "$A_ZEIT" +%s 2>/dev/null || echo 0)" -v n="$(date +%s)" 'BEGIN{ if (m > 0) printf "%.1f", (n-m)/3600 }')
fi

# Vault: Stunden seit dem letzten Commit, Konflikt (Rebase abgebrochen → Marker)
V_STUNDEN=""; V_KONFLIKT=false
if [ -d "$BASIS/vault/.git" ]; then
  LC=$(git -C "$BASIS/vault" log -1 --format=%ct 2>/dev/null)
  [ -n "$LC" ] && V_STUNDEN=$(awk -v m="$LC" -v n="$(date +%s)" 'BEGIN{printf "%.1f", (n-m)/3600}')
  [ -d "$BASIS/vault/.git/rebase-merge" ] || [ -d "$BASIS/vault/.git/rebase-apply" ] && V_KONFLIKT=true
fi

# Updates: wartende Sicherheitsupdates, Neustart nötig
UPD=$(apt list --upgradable 2>/dev/null | grep -c security || echo 0)
NEUSTART=false; [ -f /var/run/reboot-required ] && NEUSTART=true

TMP="$ZIEL.tmp"
cat >"$TMP" <<EOF
{
  "zeit": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "platte": { "frei_gb": $(zahl "$P_FREI"), "belegt_prozent": $(zahl "$P_BELEGT") },
  "speicher": { "frei_mb": $(zahl "$M_FREI"), "gesamt_mb": $(zahl "$M_GESAMT"), "swap_belegt_mb": $(zahl "$SW_BELEGT") },
  "last": { "m1": $(zahl "$L1"), "m5": $(zahl "$L5"), "m15": $(zahl "$L15"), "kerne": $(zahl "$KERNE") },
  "container": $CONTAINER,
  "fail2ban": { "gesperrt": $(zahl "$F2B_GESPERRT"), "versuche_24h": $(zahl "$F2B_VERSUCHE") },
  "ssh": { "fehlversuche_24h": $(zahl "$SSH_FEHL") },
  "zertifikat": { "tage": $(zahl "$Z_TAGE"), "bis": $( [ -n "$Z_BIS" ] && printf '"%s"' "$Z_BIS" || printf 'null') },
  "sicherung": { "alter_stunden": $(zahl "$S_ALTER"), "groesse_mb": $(zahl "$S_GROESSE"), "datei": $( [ -n "$S_DATEI" ] && printf '"%s"' "$S_DATEI" || printf 'null') },
  "abholung": { "alter_stunden": $(zahl "$A_ALTER"), "datei": $( [ -n "$A_DATEI" ] && printf '"%s"' "$A_DATEI" || printf 'null') },
  "vault": { "letzter_commit_stunden": $(zahl "$V_STUNDEN"), "konflikt": $V_KONFLIKT },
  "kernel_neustart_noetig": $NEUSTART,
  "updates": { "sicherheit": $(zahl "$UPD") }
}
EOF
# Die App liest als Container-Nutzer (make): lesbar für den Besitzer des Datenordners.
chmod 640 "$TMP" && mv "$TMP" "$ZIEL"
