#!/usr/bin/env bash
# ─── MAKE OS · Nächtliche verschlüsselte Sicherung (Cron auf dem Server) ────
# Packt /srv/make-os/daten, verschlüsselt mit dem Passwort aus
# /srv/make-os/.sicherung-passwort (AES-256, PBKDF2), behält 14 Tage.
# Zurückholen:
#   openssl enc -d -aes-256-cbc -pbkdf2 -pass file:/srv/make-os/.sicherung-passwort \
#     -in make-os-JJJJ-MM-TT.tar.gz.enc | tar xz -C /tmp/wiederherstellen
# Seit 26.09.: liegt /srv/make-os/sicherung.pub (Kevins öffentlicher age-Schlüssel), wird damit
# verschlüsselt — der Server kann dann nur VERschlüsseln, entschlüsseln nur Kevin (privater Schlüssel im
# Passwort-Manager). Zurückholen: age -d -i schluessel.txt make-os-…tar.gz.age | tar xz -C /tmp/wiederherstellen
set -euo pipefail
BASIS=/srv/make-os
if [ -s "$BASIS/sicherung.pub" ] && command -v age >/dev/null; then
  ZIEL="$BASIS/sicherungen/make-os-$(date +%F).tar.gz.age"
  tar czf - -C "$BASIS" daten | age -R "$BASIS/sicherung.pub" -o "$ZIEL"
else
  ZIEL="$BASIS/sicherungen/make-os-$(date +%F).tar.gz.enc"
  tar czf - -C "$BASIS" daten | openssl enc -aes-256-cbc -pbkdf2 -salt -pass "file:$BASIS/.sicherung-passwort" -out "$ZIEL"
fi
chmod 600 "$ZIEL"
find "$BASIS/sicherungen" \( -name 'make-os-*.tar.gz.enc' -o -name 'make-os-*.tar.gz.age' \) -mtime +14 -delete
echo "$(date '+%F %T') Sicherung $(basename "$ZIEL") $(du -h "$ZIEL" | cut -f1)"
