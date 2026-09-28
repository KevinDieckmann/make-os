#!/usr/bin/env bash
# ─── MAKE OS · Probe-Restore einer Sicherung am Mac (quartalsweise — 28.09., seit 29.09. mit App-Start) ───
# Eine Sicherung, die nie zurückgeholt wurde, ist keine. Dieses Skript holt ein Tagesarchiv vollständig
# zurück — nur in einen Temp-Ordner, der am Ende gelöscht wird — und misst, wie lange es dauert (RTO):
#   1. Archiv mit age entschlüsseln (age-Identität aus dem Passwort-Manager) und entpacken
#   2. jeden Bestand mit dem Datenschlüssel entschlüsseln, parsen, zählen (scripts/sicherung-pruefen.mjs —
#      nur Zahlen, nie Inhalte; der Schlüssel wird nie ausgegeben), Archiv und Dateiablage prüfen
#   3. mit --app: MAKE OS im Probe-Ordner starten (MAKE_OS_DATEN_DIR, Port 3098, nur 127.0.0.1) und warten,
#      bis die Anmeldung antwortet — Dauer von Beginn bis „läuft“ = gemessene Wiederherstellungszeit
#   4. Temp-Ordner löschen (auch bei Abbruch)
#
# Am Mac vorbereiten (einmalig):
#   brew install age                      # Homebrew; ohne Homebrew: https://github.com/FiloSottile/age/releases
#   Node liegt unter ~/.local/node22/bin (start.sh nutzt denselben); für --app einmal ./start.sh laufen lassen
#   (baut .next-prod), oder: MAKE_OS_DIST=.next-prod node node_modules/next/dist/bin/next build
# Aufruf (Archiv vom Mac-Abholordner ~/MAKE-OS-Sicherungen, sonst scp make@…:/srv/make-os/sicherungen/… .):
#   read -rs MAKE_OS_DATEN_SCHLUESSEL && export MAKE_OS_DATEN_SCHLUESSEL
#   deploy/sicherung-probe.sh ~/MAKE-OS-Sicherungen/make-os-JJJJ-MM-TT.tar.gz.age ~/pfad/age-identitaet.txt [--app]
# Ältere .enc-Archive (openssl, vor dem 26.09.): statt der age-Identität die Passwort-Datei angeben.
# Archive von vor einer Schlüsselrotation brauchen den ALTEN Datenschlüssel: zusätzlich
#   read -rs MAKE_OS_DATEN_SCHLUESSEL_ALT && export MAKE_OS_DATEN_SCHLUESSEL_ALT
# Ergebnis eintragen: DEPLOY.md › Probe-Restore (Datum, Archiv, Bestände, Dauer, Auffälligkeiten).
set -euo pipefail

ARCHIV="${1:-}"
SCHLUESSEL_DATEI="${2:-}"
MIT_APP=0; [ "${3:-}" = "--app" ] && MIT_APP=1
[ -n "$ARCHIV" ] && [ -f "$ARCHIV" ] || { echo "Aufruf: $0 <archiv.tar.gz.age|.enc> <age-identitaet.txt|passwort-datei> [--app]"; exit 1; }
[ -n "$SCHLUESSEL_DATEI" ] && [ -f "$SCHLUESSEL_DATEI" ] || { echo "age-Identität bzw. Passwort-Datei fehlt (2. Argument)."; exit 1; }
[ -n "${MAKE_OS_DATEN_SCHLUESSEL:-}" ] || { echo "MAKE_OS_DATEN_SCHLUESSEL fehlt in der Umgebung (read -rs … && export …)."; exit 1; }
export PATH="$HOME/.local/node22/bin:$PATH"
command -v node >/dev/null || { echo "node fehlt (~/.local/node22/bin)."; exit 1; }
REPO="$(cd "$(dirname "$0")/.." && pwd)"
START=$(date +%s)
APP_PID=""

TMP="$(mktemp -d "${TMPDIR:-/tmp}/make-os-probe.XXXXXX")"
chmod 700 "$TMP"
trap 'rm -rf "$TMP"' EXIT INT TERM
aufraeumen_app() { [ -n "$APP_PID" ] && kill "$APP_PID" 2>/dev/null && wait "$APP_PID" 2>/dev/null; rm -rf "$TMP"; }

echo "▸ entschlüsseln und entpacken (Temp-Ordner, wird am Ende gelöscht)"
case "$ARCHIV" in
  *.age)
    command -v age >/dev/null || { echo "age fehlt — am Mac: brew install age"; exit 1; }
    age -d -i "$SCHLUESSEL_DATEI" "$ARCHIV" | tar xzf - -C "$TMP" ;;
  *.enc)
    openssl enc -d -aes-256-cbc -pbkdf2 -pass "file:$SCHLUESSEL_DATEI" -in "$ARCHIV" | tar xzf - -C "$TMP" ;;
  *) echo "Unbekanntes Archiv (erwartet .tar.gz.age oder .tar.gz.enc)."; exit 1 ;;
esac
[ -d "$TMP/daten" ] || { echo "Im Archiv fehlt der Ordner daten/ — Archiv unvollständig?"; exit 1; }
echo "  entpackt nach $(( $(date +%s) - START )) s"

echo "▸ Bestände entschlüsseln, parsen und zählen (nur Zahlen)"
node "$REPO/scripts/sicherung-pruefen.mjs" "$TMP/daten"

if [ "$MIT_APP" = 1 ]; then
  echo "▸ MAKE OS im Probe-Ordner starten (Port 3098, nur dieser Rechner)"
  [ -f "$REPO/.next-prod/BUILD_ID" ] || { echo "  Kein Produktionsbau (.next-prod) — einmal ./start.sh laufen lassen."; exit 1; }
  trap aufraeumen_app EXIT INT TERM
  mkdir -p "$TMP/vault"
  ( cd "$REPO" && exec env MAKE_OS_DATEN_DIR="$TMP/daten" MAKE_OS_DIST=.next-prod MAKE_VAULT_DIR="$TMP/vault" MAKE_OS_EMBEDDINGS=aus \
      MAKE_OS_DOKU_WURZEL=aus NODE_ENV=production node node_modules/next/dist/bin/next start -p 3098 -H 127.0.0.1 >"$TMP/app.log" 2>&1 ) &
  APP_PID=$!
  for _ in $(seq 1 120); do
    if curl -fsS -o /dev/null "http://127.0.0.1:3098/anmelden" 2>/dev/null; then
      echo "  ✓ App antwortet — Wiederherstellung (entpacken + prüfen + starten) in $(( $(date +%s) - START )) s"
      break
    fi
    kill -0 "$APP_PID" 2>/dev/null || { echo "  ✗ App ist beim Start beendet — Protokoll:"; tail -20 "$TMP/app.log"; exit 1; }
    sleep 1
  done
  curl -fsS -o /dev/null "http://127.0.0.1:3098/anmelden" 2>/dev/null || { echo "  ✗ App antwortet nach 120 s nicht."; exit 1; }
fi
echo "▸ Gesamtdauer $(( $(date +%s) - START )) s — Temp-Ordner wird gelöscht."
