#!/usr/bin/env bash
# ─── MAKE OS · Nächtliche verschlüsselte Sicherung (Cron auf dem Server) ────
# Packt /srv/make-os/daten, verschlüsselt mit dem Passwort aus
# /srv/make-os/.sicherung-passwort (AES-256, PBKDF2), behält 14 Tage.
# Zurückholen:
#   openssl enc -d -aes-256-cbc -pbkdf2 -pass file:/srv/make-os/.sicherung-passwort \
#     -in make-os-JJJJ-MM-TT.tar.gz.enc | tar xz -C /tmp/wiederherstellen
set -euo pipefail
BASIS=/srv/make-os
ZIEL="$BASIS/sicherungen/make-os-$(date +%F).tar.gz.enc"
tar czf - -C "$BASIS" daten | openssl enc -aes-256-cbc -pbkdf2 -salt -pass "file:$BASIS/.sicherung-passwort" -out "$ZIEL"
find "$BASIS/sicherungen" -name 'make-os-*.tar.gz.enc' -mtime +14 -delete
echo "$(date '+%F %T') Sicherung $(basename "$ZIEL") $(du -h "$ZIEL" | cut -f1)"
