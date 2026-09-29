#!/usr/bin/env bash
# ─── MAKE OS · Sicherung auf den Mac ziehen (launchd, täglich — 29.09., Paket D-A #57/#58/#64) ───────────
# Kevin: „Auf euren Mac ziehen.“ Zweiter Ort außerhalb von Hetzner: der Mac holt jede Nacht das neueste
# verschlüsselte Archiv (age) ab. Der Zugang ist NUR LESEND — der Schlüssel darf auf dem Server nur
# deploy/sicherung-ausgeben.sh ausführen (Forced Command). Der Server kann den Mac nie erreichen, also auch
# nichts auf dem Mac löschen (Schutz gegen eine Übernahme des Servers, #58).
#
# Ablauf: liste (Name, Größe, SHA-256) → holen → Größe + SHA-256 prüfen → ablegen (0600) → bestaetigen
# (Server schreibt die Marke „letzte Abholung“ für den Head of IT; > 48 h → Warnung) → Generationen am Mac
# (14 täglich / 8 wöchentlich / 12 monatlich, deploy/generationen.sh). Optional ganz prüfen, wenn die
# age-Identität auf dem Mac liegt (MAKE_OS_AGE_IDENTITAET=Pfad): entschlüsseln + tar-Liste lesen.
# Beide Formate kommen an: .tar.gz.age (Normalweg) und .tar.gz.enc (openssl-Übergang, wenn am Server age/sicherung.pub
# fehlt — deploy/sicherung.sh, HOI rot). Vollprüfung einer .enc nur mit MAKE_OS_SICHERUNG_PASSWORT_DATEI=Pfad.
#
# Einrichten (einmalig, am Mac):
#   deploy/sicherung-abholen.sh --einrichten      # erzeugt ~/.ssh/make-os-abholung + zeigt die Zeile für den Server
#   cp deploy/de.makeos.sicherung.plist ~/Library/LaunchAgents/ && launchctl load ~/Library/LaunchAgents/de.makeos.sicherung.plist
# Einstellungen (Umgebung oder ~/.config/make-os/abholung.env):
#   MAKE_OS_ABHOL_HOST   (Vorgabe make@2.28.108.162)   MAKE_OS_ABHOL_ZIEL (Vorgabe ~/MAKE-OS-Sicherungen)
#   MAKE_OS_ABHOL_SCHLUESSEL (Vorgabe ~/.ssh/make-os-abholung)
#   MAKE_OS_ABHOL_SSH  — nur für Tests: ersetzt „ssh …“ (bekommt den Befehl als Argument)
set -euo pipefail
umask 077
KONF="$HOME/.config/make-os/abholung.env"
# shellcheck disable=SC1090
[ -f "$KONF" ] && source "$KONF"
HOST=${MAKE_OS_ABHOL_HOST:-make@2.28.108.162}
ZIEL=${MAKE_OS_ABHOL_ZIEL:-$HOME/MAKE-OS-Sicherungen}
SCHLUESSEL=${MAKE_OS_ABHOL_SCHLUESSEL:-$HOME/.ssh/make-os-abholung}
SKRIPTE="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=deploy/generationen.sh
source "$SKRIPTE/generationen.sh"
log() { echo "$(date '+%F %T') $*"; }

if [ "${1:-}" = "--einrichten" ]; then
  [ -f "$SCHLUESSEL" ] || ssh-keygen -t ed25519 -N "" -f "$SCHLUESSEL" -C "make-os-abholung" >/dev/null
  echo "Diese Zeile auf dem Server in /home/make/.ssh/authorized_keys eintragen (als make):"
  echo "command=\"/srv/make-os/app/deploy/sicherung-ausgeben.sh\",restrict $(cat "$SCHLUESSEL.pub")"
  echo "Danach einmal testen: $0"
  exit 0
fi

server() {
  if [ -n "${MAKE_OS_ABHOL_SSH:-}" ]; then $MAKE_OS_ABHOL_SSH "$*"
  else ssh -i "$SCHLUESSEL" -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=20 "$HOST" "$*"
  fi
}
sha() { shasum -a 256 "$1" | cut -d' ' -f1; }

mkdir -p "$ZIEL"; chmod 700 "$ZIEL"
read -r NAME BYTES SUMME <<<"$(server liste)"
[[ "${NAME:-}" =~ ^make-os-[0-9]{4}-[0-9]{2}-[0-9]{2}\.tar\.gz\.(age|enc)$ ]] || { log "Server lieferte keine Sicherung"; exit 1; }
[[ "${SUMME:-}" =~ ^[0-9a-f]{64}$ ]] || { log "Server lieferte keine Prüfsumme"; exit 1; }

if [ -f "$ZIEL/$NAME" ] && [ "$(sha "$ZIEL/$NAME")" = "$SUMME" ]; then
  log "$NAME liegt schon vollständig hier"
else
  TMP="$ZIEL/.$NAME.teil"
  trap 'rm -f "$TMP"' EXIT
  server holen "$NAME" >"$TMP"
  [ "$(wc -c <"$TMP" | tr -d ' ')" = "$BYTES" ] || { log "Größe passt nicht ($NAME) — verworfen"; exit 1; }
  [ "$(sha "$TMP")" = "$SUMME" ] || { log "Prüfsumme passt nicht ($NAME) — verworfen"; exit 1; }
  chmod 600 "$TMP" && mv "$TMP" "$ZIEL/$NAME"
  log "$NAME geholt ($(( BYTES / 1024 )) KB)"
fi

if [ -n "${MAKE_OS_AGE_IDENTITAET:-}" ] && [[ "$NAME" == *.age ]]; then
  command -v age >/dev/null || { log "age fehlt (brew install age) — Vollprüfung übersprungen"; }
  if command -v age >/dev/null; then
    age -d -i "$MAKE_OS_AGE_IDENTITAET" "$ZIEL/$NAME" | tar -tzf - >/dev/null && log "Vollprüfung: entschlüsselbar, tar lesbar" || { log "Vollprüfung FEHLGESCHLAGEN"; exit 1; }
  fi
fi

if [[ "$NAME" == *.enc ]]; then
  log "Hinweis: $NAME ist nur mit der Übergangs-Verschlüsselung (openssl) gesichert — am Server age einrichten (DEPLOY.md › Sicherung)"
  if [ -n "${MAKE_OS_SICHERUNG_PASSWORT_DATEI:-}" ]; then
    openssl enc -d -aes-256-cbc -pbkdf2 -pass "file:$MAKE_OS_SICHERUNG_PASSWORT_DATEI" -in "$ZIEL/$NAME" | tar -tzf - >/dev/null && log "Vollprüfung: entschlüsselbar, tar lesbar" || { log "Vollprüfung FEHLGESCHLAGEN"; exit 1; }
  fi
fi

server bestaetigen "$NAME" "$SUMME" >/dev/null && log "Abholung bestätigt"
generationen_aufraeumen "$ZIEL" 14 8 12
log "am Mac: $(ls -1 "$ZIEL" | grep -c '^make-os-' || true) Archive"
